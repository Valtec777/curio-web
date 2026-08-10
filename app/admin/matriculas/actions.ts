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
});

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

export async function createGuardianEnrollment(formData: FormData) {
  const parsed = enrollmentSchema.safeParse({
    idempotencyKey: formData.get("idempotencyKey"),
    fullName: formData.get("fullName"),
    preferredName: String(formData.get("preferredName") || ""),
    email: formData.get("email"),
    phone: String(formData.get("phone") || ""),
    childName: formData.get("childName"),
    childPreferredName: String(formData.get("childPreferredName") || ""),
    gradeId: String(formData.get("gradeId") || ""),
    schoolName: String(formData.get("schoolName") || ""),
    relationship: String(formData.get("relationship") || "Responsável"),
  });

  if (!parsed.success) {
    redirect(`/admin/matriculas?erro=${encodeURIComponent(parsed.error.issues[0]?.message || "Confira os dados da matrícula.")}`);
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
    redirect(`/admin/matriculas?erro=${encodeURIComponent(result.message || "Falha ao liberar acesso.")}`);
  }

  revalidatePath("/admin/matriculas");
  revalidatePath("/admin/familias");
  revalidatePath("/admin/alunos");

  if (result.data?.processing) {
    redirect(`/admin/matriculas?sucesso=${encodeURIComponent("Essa matrícula já estava em processamento. Nenhum registro duplicado foi criado.")}`);
  }
  if (result.data?.reused) {
    redirect(`/admin/matriculas?sucesso=${encodeURIComponent("A matrícula já existia e foi reutilizada. Nenhum registro duplicado foi criado.")}`);
  }
  redirect(`/admin/matriculas?sucesso=${encodeURIComponent("Matrícula criada e acesso da família enviado por e-mail.")}`);
}

export async function resendGuardianInvitation(formData: FormData) {
  const invitationId = z.string().uuid().safeParse(formData.get("invitationId"));
  if (!invitationId.success) return;

  const result = await invokeAccessAdmin({
    action: "resend",
    invitation_id: invitationId.data,
    origin: await currentOrigin(),
  });
  if (!result.ok) {
    redirect(`/admin/matriculas?erro=${encodeURIComponent(result.message || "Não foi possível reenviar o acesso.")}`);
  }
  revalidatePath("/admin/matriculas");
  redirect(`/admin/matriculas?sucesso=${encodeURIComponent("Novo link enviado para o e-mail cadastrado.")}`);
}

export async function cancelGuardianInvitation(formData: FormData) {
  const viewer = await requireRole("admin");
  const invitationId = z.string().uuid().safeParse(formData.get("invitationId"));
  if (!invitationId.success) return;

  const supabase = await createClient();
  const { data: invitation } = await supabase
    .from("access_invitations")
    .select("id,status,deleted_at")
    .eq("id", invitationId.data)
    .maybeSingle();

  if (!invitation || invitation.deleted_at) {
    redirect(`/admin/matriculas?erro=${encodeURIComponent("Convite não encontrado.")}`);
  }
  if (invitation.status === "accepted") {
    redirect(`/admin/matriculas?erro=${encodeURIComponent("Este acesso já foi aceito. Para retirar acesso, use a gestão de usuários sem apagar o histórico.")}`);
  }

  const { error } = await supabase.from("access_invitations").update({
    status: "cancelled",
    last_error: null,
    updated_at: new Date().toISOString(),
  }).eq("id", invitation.id);

  if (error) redirect(`/admin/matriculas?erro=${encodeURIComponent("Não foi possível cancelar o convite.")}`);
  revalidatePath("/admin/matriculas");
  void viewer;
  redirect(`/admin/matriculas?sucesso=${encodeURIComponent("Convite cancelado. O registro foi preservado no histórico.")}`);
}

export async function moveGuardianInvitationToTrash(formData: FormData) {
  const viewer = await requireRole("admin");
  const parsed = z.object({
    invitationId: z.string().uuid(),
    reason: z.string().max(300).optional(),
  }).safeParse({
    invitationId: formData.get("invitationId"),
    reason: String(formData.get("reason") || ""),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  const { data: invitation } = await supabase
    .from("access_invitations")
    .select("id,email,full_name,status,student_id,auth_user_id,created_at,deleted_at")
    .eq("id", parsed.data.invitationId)
    .maybeSingle();

  if (!invitation || invitation.deleted_at) {
    redirect(`/admin/matriculas?erro=${encodeURIComponent("Convite não encontrado ou já removido.")}`);
  }

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
      created_at: invitation.created_at,
      reason,
    },
    deleted_by_user_id: viewer.user.id,
    deleted_at: now.toISOString(),
    restore_until: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });

  if (trashError && trashError.code !== "23505") {
    redirect(`/admin/matriculas?erro=${encodeURIComponent("Não foi possível enviar o convite para a Lixeira.")}`);
  }

  const { error } = await supabase.from("access_invitations").update({
    deleted_at: now.toISOString(),
    deleted_by_user_id: viewer.user.id,
    delete_reason: reason,
    status: invitation.status === "accepted" ? "accepted" : "cancelled",
    updated_at: now.toISOString(),
  }).eq("id", invitation.id);

  if (error) redirect(`/admin/matriculas?erro=${encodeURIComponent("Não foi possível remover o convite da operação.")}`);
  revalidatePath("/admin/matriculas");
  revalidatePath("/admin/lixeira");
  redirect(`/admin/matriculas?sucesso=${encodeURIComponent("Convite removido da operação e enviado para a Lixeira. O aluno vinculado não foi apagado automaticamente.")}`);
}

export async function moveEnrollmentRequestToTrash(formData: FormData) {
  const viewer = await requireRole("admin");
  const parsed = z.object({
    requestId: z.string().uuid(),
    reason: z.string().max(300).optional(),
  }).safeParse({
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

  if (!request || request.deleted_at) {
    redirect(`/admin/matriculas?erro=${encodeURIComponent("Solicitação não encontrada ou já removida.")}`);
  }

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

  if (trashError && trashError.code !== "23505") {
    redirect(`/admin/matriculas?erro=${encodeURIComponent("Não foi possível enviar a solicitação para a Lixeira.")}`);
  }

  const { error } = await supabase.from("enrollment_requests").update({
    deleted_at: now.toISOString(),
    deleted_by_user_id: viewer.user.id,
    delete_reason: reason,
    status: "closed",
    updated_at: now.toISOString(),
  }).eq("id", request.id);

  if (error) redirect(`/admin/matriculas?erro=${encodeURIComponent("Não foi possível remover a solicitação da operação.")}`);
  revalidatePath("/admin/matriculas");
  revalidatePath("/admin/lixeira");
  redirect(`/admin/matriculas?sucesso=${encodeURIComponent("Solicitação enviada para a Lixeira.")}`);
}
