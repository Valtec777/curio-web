"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function refreshEnrollmentPaths() {
  revalidatePath("/admin/matriculas");
  revalidatePath("/admin/alunos");
  revalidatePath("/admin/familias");
  revalidatePath("/admin/professores");
  revalidatePath("/professor/alunos");
  revalidatePath("/familia");
  revalidatePath("/aluno");
}

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
  const { error } = await supabase.rpc("finalize_guardian_enrollment", {
    p_invitation_id: parsed.data.invitationId,
    p_teacher_id: parsed.data.teacherId,
    p_plan_id: parsed.data.planId,
  });

  if (error) {
    console.error("Falha ao atualizar professor/plano da matrícula", error.code);
    redirect(`/admin/matriculas?erro=${encodeURIComponent("Não foi possível atualizar professor e plano. Nenhuma alteração parcial deve ser mantida; revise os vínculos e tente novamente.")}`);
  }

  refreshEnrollmentPaths();
  redirect(`/admin/matriculas?sucesso=${encodeURIComponent("Professor e plano atualizados em uma única operação, sem recriar a matrícula.")}`);
}

const enrollmentDetailsSchema = z.object({
  invitationId: z.string().uuid(),
  studentFullName: z.string().trim().min(2).max(160),
  studentPreferredName: z.string().trim().max(120).optional(),
  gradeId: z.string().uuid().optional().or(z.literal("")),
  schoolName: z.string().trim().max(200).optional(),
  guardianFullName: z.string().trim().min(2).max(160),
  guardianPreferredName: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  relationship: z.string().trim().min(2).max(100),
});

export async function updateEnrollmentDetails(formData: FormData) {
  await requireRole("admin");
  const parsed = enrollmentDetailsSchema.safeParse({
    invitationId: formData.get("invitationId"),
    studentFullName: formData.get("studentFullName"),
    studentPreferredName: String(formData.get("studentPreferredName") || ""),
    gradeId: String(formData.get("gradeId") || ""),
    schoolName: String(formData.get("schoolName") || ""),
    guardianFullName: formData.get("guardianFullName"),
    guardianPreferredName: String(formData.get("guardianPreferredName") || ""),
    phone: String(formData.get("phone") || ""),
    relationship: formData.get("relationship"),
  });

  if (!parsed.success) {
    redirect(`/admin/matriculas?erro=${encodeURIComponent(parsed.error.issues[0]?.message || "Revise os dados da matrícula.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_admin_enrollment_details", {
    p_invitation_id: parsed.data.invitationId,
    p_student_full_name: parsed.data.studentFullName,
    p_student_preferred_name: parsed.data.studentPreferredName || "",
    p_grade_id: parsed.data.gradeId || null,
    p_school_name: parsed.data.schoolName || "",
    p_guardian_full_name: parsed.data.guardianFullName,
    p_guardian_preferred_name: parsed.data.guardianPreferredName || "",
    p_phone_whatsapp: parsed.data.phone || "",
    p_relationship: parsed.data.relationship,
  });

  if (error) {
    console.error("Falha ao editar dados da matrícula", error.code);
    redirect(`/admin/matriculas?erro=${encodeURIComponent("Não foi possível salvar os dados da matrícula. A operação foi rejeitada sem recriar os registros.")}`);
  }

  refreshEnrollmentPaths();
  redirect(`/admin/matriculas?sucesso=${encodeURIComponent("Dados do aluno, responsável e vínculo atualizados com os mesmos IDs.")}`);
}
