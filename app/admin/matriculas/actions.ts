"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const enrollmentSchema = z.object({
  idempotencyKey: z.string().min(8).max(160),
  fullName: z.string().min(2, "Informe o nome completo."),
  preferredName: z.string().optional(),
  email: z.string().email("Informe um e-mail válido."),
  phone: z.string().optional(),
  childName: z.string().min(2, "Informe o nome do aluno."),
  childPreferredName: z.string().optional(),
  gradeId: z.string().uuid().optional().or(z.literal("")),
  schoolName: z.string().optional(),
  relationship: z.string().min(2).default("Responsável"),
  teacherId: z.string().uuid("Selecione o professor."),
  planId: z.string().uuid("Selecione o plano."),
});

function enrollmentUrl(kind: "erro" | "sucesso", message: string, operationKey?: string) {
  const params = new URLSearchParams({ [kind]: message });
  if (operationKey) params.set("op", operationKey);
  return `/admin/matriculas?${params.toString()}`;
}

async function currentOrigin() {
  const h = await headers();
  return (h.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

async function invokeAccessAdmin(body: Record<string, unknown>) {
  await requireRole("admin");
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("curio-access-admin", { body });
  if (error || data?.error) {
    return { ok: false as const, message: data?.error || "Não foi possível enviar o acesso agora." };
  }
  return { ok: true as const, data };
}

async function finalizeEnrollmentLinks(invitationId: string, teacherId: string, planId: string) {
  const supabase = await createClient();
  const { data: invitation, error: invitationError } = await supabase
    .from("access_invitations")
    .select("id,student_id,auth_user_id,relationship,deleted_at")
    .eq("id", invitationId)
    .maybeSingle();
  if (invitationError || !invitation || invitation.deleted_at || !invitation.student_id || !invitation.auth_user_id) {
    return { ok: false as const, message: "O acesso foi criado, mas a matrícula ainda não está pronta para finalizar." };
  }

  const [{ data: teacher }, { data: plan }, { data: guardian }] = await Promise.all([
    supabase.from("teachers").select("id").eq("id", teacherId).eq("active", true).maybeSingle(),
    supabase.from("plans").select("id,monthly_price").eq("id", planId).eq("active", true).eq("available_for_enrollment", true).is("archived_at", null).is("deleted_at", null).maybeSingle(),
    supabase.from("guardians").select("id").eq("profile_id", invitation.auth_user_id).maybeSingle(),
  ]);

  if (!teacher) return { ok: false as const, message: "O professor selecionado não está disponível." };
  if (!plan) return { ok: false as const, message: "O plano selecionado não está disponível para matrícula." };
  if (!guardian) return { ok: false as const, message: "O perfil do responsável ainda não foi concluído." };

  const { error: guardianError } = await supabase.from("guardian_students").upsert({
    guardian_id: guardian.id,
    student_id: invitation.student_id,
    relationship: invitation.relationship || "Responsável",
    can_view_progress: true,
    can_manage_access: true,
  }, { onConflict: "guardian_id,student_id" });
  if (guardianError) return { ok: false as const, message: "Não foi possível concluir o vínculo da família com o aluno." };

  const { error: teacherError } = await supabase.from("teacher_students").upsert({
    teacher_id: teacher.id,
    student_id: invitation.student_id,
    active: true,
  }, { onConflict: "teacher_id,student_id" });
  if (teacherError) return { ok: false as const, message: "Não foi possível concluir o vínculo do professor com o aluno." };

  const { data: currentSubscription } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("student_id", invitation.student_id)
    .in("status", ["pending", "active"])
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (currentSubscription) {
    const { error } = await supabase.from("subscriptions").update({
      guardian_id: guardian.id,
      plan_id: plan.id,
      agreed_monthly_price: plan.monthly_price,
      updated_at: new Date().toISOString(),
    }).eq("id", currentSubscription.id);
    if (error) return { ok: false as const, message: "Não foi possível atualizar o plano da matrícula." };
  } else {
    const { error } = await supabase.from("subscriptions").insert({
      guardian_id: guardian.id,
      student_id: invitation.student_id,
      plan_id: plan.id,
      status: "pending",
      agreed_monthly_price: plan.monthly_price,
      starts_at: new Date().toISOString().slice(0, 10),
    });
    if (error && error.code !== "23505") {
      return { ok: false as const, message: "Não foi possível vincular o plano à matrícula." };
    }
  }

  const { error: finalizeError } = await supabase.from("access_invitations").update({
    teacher_id: teacher.id,
    plan_id: plan.id,
    enrollment_finalized_at: new Date().toISOString(),
    last_error: null,
    updated_at: new Date().toISOString(),
  }).eq("id", invitation.id);
  if (finalizeError) return { ok: false as const, message: "Os vínculos foram criados, mas não foi possível marcar a matrícula como finalizada." };

  return { ok: true as const, studentId: invitation.student_id };
}

export async function createGuardianEnrollment(formData: FormData) {
  const operationKey = String(formData.get("idempotencyKey") || "");
  const parsed = enrollmentSchema.safeParse({
    idempotencyKey: operationKey,
    fullName: formData.get("fullName"),
    preferredName: String(formData.get("preferredName") || ""),
    email: formData.get("email"),
    phone: String(formData.get("phone") || ""),
    childName: formData.get("childName"),
    childPreferredName: String(formData.get("childPreferredName") || ""),
    gradeId: String(formData.get("gradeId") || ""),
    schoolName: String(formData.get("schoolName") || ""),
    relationship: String(formData.get("relationship") || "Responsável"),
    teacherId: formData.get("teacherId"),
    planId: formData.get("planId"),
  });

  if (!parsed.success) {
    redirect(enrollmentUrl("erro", parsed.error.issues[0]?.message || "Confira os dados da matrícula.", operationKey || undefined));
  }

  const result = await invokeAccessAdmin({
    action: "invite",
    idempotency_key: parsed.data.idempotencyKey,
    role: "guardian",
    full_name: parsed.data.fullName,
    preferred_name: parsed.data.preferredName || null,
    email: parsed.data.email,
    phone_whatsapp: parsed.data.phone || null,
    relationship: parsed.data.relationship,
    origin: await currentOrigin(),
    student: {
      full_name: parsed.data.childName,
      preferred_name: parsed.data.childPreferredName || parsed.data.childName,
      grade_id: parsed.data.gradeId || null,
      school_name: parsed.data.schoolName || null,
      status: "active",
    },
  });

  if (!result.ok) {
    redirect(enrollmentUrl("erro", result.message || "Falha ao liberar acesso.", parsed.data.idempotencyKey));
  }

  if (result.data?.processing) {
    redirect(enrollmentUrl("sucesso", "Essa matrícula já está em processamento. Nenhum registro duplicado foi criado.", parsed.data.idempotencyKey));
  }

  const invitationId = String(result.data?.invitation_id || "");
  if (!z.string().uuid().safeParse(invitationId).success) {
    redirect(enrollmentUrl("erro", "O acesso foi criado, mas o sistema não recebeu o identificador da matrícula para concluir os vínculos.", parsed.data.idempotencyKey));
  }

  const finalized = await finalizeEnrollmentLinks(invitationId, parsed.data.teacherId, parsed.data.planId);
  if (!finalized.ok) {
    redirect(enrollmentUrl("erro", `${finalized.message} Tente concluir novamente; o aluno já criado será reutilizado.`, parsed.data.idempotencyKey));
  }

  revalidatePath("/admin/matriculas");
  revalidatePath("/admin/familias");
  revalidatePath("/admin/alunos");
  revalidatePath("/admin/professores");
  revalidatePath("/professor/alunos");
  revalidatePath("/familia");

  redirect(enrollmentUrl("sucesso", result.data?.reused
    ? "Matrícula retomada e concluída sem duplicar aluno, responsável ou convite."
    : "Matrícula concluída: aluno, família, professor, plano e acesso foram vinculados."));
}

export async function resendGuardianInvitation(formData: FormData) {
  const invitationId = z.string().uuid().safeParse(formData.get("invitationId"));
  if (!invitationId.success) return;

  const result = await invokeAccessAdmin({
    action: "resend",
    invitation_id: invitationId.data,
    origin: await currentOrigin(),
  });
  if (!result.ok) redirect(enrollmentUrl("erro", result.message || "Não foi possível reenviar o acesso."));
  revalidatePath("/admin/matriculas");
  redirect(enrollmentUrl("sucesso", "Novo link enviado para o e-mail cadastrado."));
}

export async function cancelGuardianInvitation(formData: FormData) {
  await requireRole("admin");
  const invitationId = z.string().uuid().safeParse(formData.get("invitationId"));
  if (!invitationId.success) return;

  const supabase = await createClient();
  const { data: invitation } = await supabase
    .from("access_invitations")
    .select("id,status,deleted_at")
    .eq("id", invitationId.data)
    .maybeSingle();

  if (!invitation || invitation.deleted_at) redirect(enrollmentUrl("erro", "Convite não encontrado."));
  if (invitation.status === "accepted") {
    redirect(enrollmentUrl("erro", "Este acesso já foi aceito. Para retirar acesso, use a gestão de usuários sem apagar o histórico."));
  }

  const { error } = await supabase.from("access_invitations").update({
    status: "cancelled",
    last_error: null,
    updated_at: new Date().toISOString(),
  }).eq("id", invitation.id);

  if (error) redirect(enrollmentUrl("erro", "Não foi possível cancelar o convite."));
  revalidatePath("/admin/matriculas");
  redirect(enrollmentUrl("sucesso", "Convite cancelado. O registro foi preservado no histórico."));
}

export async function moveGuardianInvitationToTrash(formData: FormData) {
  const viewer = await requireRole("admin");
  const parsed = z.object({ invitationId: z.string().uuid(), reason: z.string().max(300).optional() }).safeParse({
    invitationId: formData.get("invitationId"),
    reason: String(formData.get("reason") || ""),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  const { data: invitation } = await supabase
    .from("access_invitations")
    .select("id,email,full_name,status,student_id,auth_user_id,teacher_id,plan_id,enrollment_finalized_at,created_at,deleted_at")
    .eq("id", parsed.data.invitationId)
    .maybeSingle();

  if (!invitation || invitation.deleted_at) redirect(enrollmentUrl("erro", "Convite não encontrado ou já removido."));

  const now = new Date();
  const reason = parsed.data.reason?.trim() || "Removido pelo Admin";
  const { error: trashError } = await supabase.from("trash_items").insert({
    entity_type: "access_invitations",
    entity_id: invitation.id,
    entity_snapshot: {
      label: invitation.full_name,
      email: invitation.email,
      previous_status: invitation.status,
      student_id: invitation.student_id,
      auth_user_id: invitation.auth_user_id,
      teacher_id: invitation.teacher_id,
      plan_id: invitation.plan_id,
      enrollment_finalized_at: invitation.enrollment_finalized_at,
      created_at: invitation.created_at,
      reason,
    },
    deleted_by_user_id: viewer.user.id,
    deleted_at: now.toISOString(),
    restore_until: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });

  if (trashError && trashError.code !== "23505") redirect(enrollmentUrl("erro", "Não foi possível enviar o convite para a Lixeira."));

  const { error } = await supabase.from("access_invitations").update({
    deleted_at: now.toISOString(),
    deleted_by_user_id: viewer.user.id,
    delete_reason: reason,
    status: invitation.status === "accepted" ? "accepted" : "cancelled",
    updated_at: now.toISOString(),
  }).eq("id", invitation.id);

  if (error) redirect(enrollmentUrl("erro", "Não foi possível remover o convite da operação."));
  revalidatePath("/admin/matriculas");
  revalidatePath("/admin/lixeira");
  redirect(enrollmentUrl("sucesso", "Convite removido da operação e enviado para a Lixeira. O aluno e os vínculos não foram apagados automaticamente."));
}

export async function moveEnrollmentRequestToTrash(formData: FormData) {
  const viewer = await requireRole("admin");
  const parsed = z.object({ requestId: z.string().uuid(), reason: z.string().max(300).optional() }).safeParse({
    requestId: formData.get("requestId"),
    reason: String(formData.get("reason") || ""),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  const { data: request } = await supabase
    .from("enrollment_requests")
    .select("id,guardian_name,email,child_name,status,created_at,deleted_at")
    .eq("id", parsed.data.requestId)
    .maybeSingle();

  if (!request || request.deleted_at) redirect(enrollmentUrl("erro", "Solicitação não encontrada ou já removida."));

  const now = new Date();
  const reason = parsed.data.reason?.trim() || "Removida pelo Admin";
  const { error: trashError } = await supabase.from("trash_items").insert({
    entity_type: "enrollment_requests",
    entity_id: request.id,
    entity_snapshot: {
      label: request.child_name || request.guardian_name,
      guardian_name: request.guardian_name,
      email: request.email,
      previous_status: request.status,
      created_at: request.created_at,
      reason,
    },
    deleted_by_user_id: viewer.user.id,
    deleted_at: now.toISOString(),
    restore_until: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });

  if (trashError && trashError.code !== "23505") redirect(enrollmentUrl("erro", "Não foi possível enviar a solicitação para a Lixeira."));

  const { error } = await supabase.from("enrollment_requests").update({
    deleted_at: now.toISOString(),
    deleted_by_user_id: viewer.user.id,
    delete_reason: reason,
    status: "closed",
    updated_at: now.toISOString(),
  }).eq("id", request.id);

  if (error) redirect(enrollmentUrl("erro", "Não foi possível remover a solicitação da operação."));
  revalidatePath("/admin/matriculas");
  revalidatePath("/admin/lixeira");
  redirect(enrollmentUrl("sucesso", "Solicitação enviada para a Lixeira."));
}
