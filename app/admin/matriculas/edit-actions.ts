"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function updateEnrollmentAssignments(formData: FormData) {
  await requireRole("admin");
  const parsed = z.object({
    invitationId: z.string().uuid(),
    teacherId: z.string().uuid(),
    planId: z.string().uuid(),
  }).safeParse({
    invitationId: formData.get("invitationId"),
    teacherId: formData.get("teacherId"),
    planId: formData.get("planId"),
  });

  if (!parsed.success) {
    redirect(`/admin/matriculas?erro=${encodeURIComponent("Selecione professor e plano válidos.")}`);
  }

  const supabase = await createClient();
  const { data: invitation } = await supabase
    .from("access_invitations")
    .select("id,student_id,auth_user_id,teacher_id,plan_id,enrollment_finalized_at,deleted_at")
    .eq("id", parsed.data.invitationId)
    .eq("role", "guardian")
    .maybeSingle();

  if (!invitation || invitation.deleted_at || !invitation.student_id) {
    redirect(`/admin/matriculas?erro=${encodeURIComponent("Matrícula não encontrada ou sem aluno vinculado.")}`);
  }

  const [{ data: teacher }, { data: plan }] = await Promise.all([
    supabase.from("teachers").select("id,active").eq("id", parsed.data.teacherId).eq("active", true).maybeSingle(),
    supabase
      .from("plans")
      .select("id,monthly_price")
      .eq("id", parsed.data.planId)
      .eq("active", true)
      .eq("available_for_enrollment", true)
      .is("archived_at", null)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);

  if (!teacher) redirect(`/admin/matriculas?erro=${encodeURIComponent("O professor selecionado não está ativo.")}`);
  if (!plan) redirect(`/admin/matriculas?erro=${encodeURIComponent("O plano selecionado não está disponível para matrícula.")}`);

  if (invitation.teacher_id && invitation.teacher_id !== teacher.id) {
    const { error: oldTeacherError } = await supabase
      .from("teacher_students")
      .update({ active: false })
      .eq("teacher_id", invitation.teacher_id)
      .eq("student_id", invitation.student_id);
    if (oldTeacherError) {
      redirect(`/admin/matriculas?erro=${encodeURIComponent("Não foi possível encerrar o vínculo do professor anterior.")}`);
    }
  }

  const { error: teacherError } = await supabase.from("teacher_students").upsert({
    teacher_id: teacher.id,
    student_id: invitation.student_id,
    active: true,
  }, { onConflict: "teacher_id,student_id" });
  if (teacherError) redirect(`/admin/matriculas?erro=${encodeURIComponent("Não foi possível vincular o novo professor.")}`);

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("student_id", invitation.student_id)
    .in("status", ["pending", "active"])
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (subscription) {
    const { error: planError } = await supabase.from("subscriptions").update({
      plan_id: plan.id,
      agreed_monthly_price: plan.monthly_price,
      updated_at: new Date().toISOString(),
    }).eq("id", subscription.id);
    if (planError) redirect(`/admin/matriculas?erro=${encodeURIComponent("O professor foi atualizado, mas não foi possível alterar o plano.")}`);
  }

  const { error: invitationError } = await supabase.from("access_invitations").update({
    teacher_id: teacher.id,
    plan_id: plan.id,
    enrollment_finalized_at: invitation.enrollment_finalized_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_error: null,
  }).eq("id", invitation.id);
  if (invitationError) {
    redirect(`/admin/matriculas?erro=${encodeURIComponent("Os vínculos foram alterados, mas não foi possível atualizar o registro da matrícula.")}`);
  }

  revalidatePath("/admin/matriculas");
  revalidatePath("/admin/alunos");
  revalidatePath("/admin/professores");
  revalidatePath("/professor/alunos");
  revalidatePath("/familia");
  redirect(`/admin/matriculas?sucesso=${encodeURIComponent("Matrícula atualizada sem recriar aluno, responsável ou acesso.")}`);
}
