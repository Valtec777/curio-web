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

const optionalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Revise a data de nascimento.").optional().or(z.literal(""));

const enrollmentDetailsSchema = z.object({
  invitationId: z.string().uuid(),
  studentFullName: z.string().trim().min(2).max(160),
  studentPreferredName: z.string().trim().max(120).optional(),
  birthDate: optionalDate,
  childCpf: z.string().trim().max(30).optional(),
  gradeId: z.string().uuid().optional().or(z.literal("")),
  schoolName: z.string().trim().max(200).optional(),
  subjects: z.array(z.string().trim().min(1).max(100)).max(20),
  pedagogicalNotes: z.string().trim().max(3000).optional(),
  guardianFullName: z.string().trim().min(2).max(160),
  guardianPreferredName: z.string().trim().max(120).optional(),
  email: z.string().trim().email("Informe um e-mail válido."),
  phone: z.string().trim().max(40).optional(),
  guardianCpf: z.string().trim().max(30).optional(),
  guardianAddress: z.string().trim().max(500).optional(),
  relationship: z.string().trim().min(2).max(100),
});

export async function updateEnrollmentDetails(formData: FormData) {
  await requireRole("admin");
  const parsed = enrollmentDetailsSchema.safeParse({
    invitationId: formData.get("invitationId"),
    studentFullName: formData.get("studentFullName"),
    studentPreferredName: String(formData.get("studentPreferredName") || ""),
    birthDate: String(formData.get("birthDate") || ""),
    childCpf: String(formData.get("childCpf") || ""),
    gradeId: String(formData.get("gradeId") || ""),
    schoolName: String(formData.get("schoolName") || ""),
    subjects: formData.getAll("subjects").map(String).filter(Boolean),
    pedagogicalNotes: String(formData.get("pedagogicalNotes") || ""),
    guardianFullName: formData.get("guardianFullName"),
    guardianPreferredName: String(formData.get("guardianPreferredName") || ""),
    email: formData.get("email"),
    phone: String(formData.get("phone") || ""),
    guardianCpf: String(formData.get("guardianCpf") || ""),
    guardianAddress: String(formData.get("guardianAddress") || ""),
    relationship: formData.get("relationship"),
  });

  if (!parsed.success) {
    redirect(`/admin/matriculas?erro=${encodeURIComponent(parsed.error.issues[0]?.message || "Revise os dados da matrícula.")}`);
  }

  const supabase = await createClient();
  const { data: invitation, error: invitationReadError } = await supabase
    .from("access_invitations")
    .select("id,email,auth_user_id")
    .eq("id", parsed.data.invitationId)
    .eq("role", "guardian")
    .is("deleted_at", null)
    .maybeSingle();

  if (invitationReadError || !invitation) {
    redirect(`/admin/matriculas?erro=${encodeURIComponent("A matrícula não foi encontrada para edição.")}`);
  }

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
    p_birth_date: parsed.data.birthDate || null,
    p_child_cpf: parsed.data.childCpf || "",
    p_subjects: parsed.data.subjects,
    p_pedagogical_notes: parsed.data.pedagogicalNotes || "",
    p_guardian_cpf: parsed.data.guardianCpf || "",
    p_guardian_address: parsed.data.guardianAddress || "",
  });

  if (error) {
    console.error("Falha ao editar dados da matrícula", error.code);
    redirect(`/admin/matriculas?erro=${encodeURIComponent("Não foi possível salvar os dados da matrícula. A operação foi rejeitada sem recriar os registros.")}`);
  }

  const currentEmail = String(invitation.email || "").trim().toLowerCase();
  const newEmail = parsed.data.email.toLowerCase();
  if (newEmail !== currentEmail) {
    const { data: emailResult, error: emailError } = await supabase.functions.invoke("curio-access-admin", {
      body: {
        action: "update_email",
        invitation_id: parsed.data.invitationId,
        email: newEmail,
      },
    });
    if (emailError || emailResult?.error) {
      console.error("Falha ao atualizar e-mail de acesso da matrícula", emailError?.message || emailResult?.error);
      refreshEnrollmentPaths();
      redirect(`/admin/matriculas?erro=${encodeURIComponent("Os demais dados foram salvos, mas o e-mail de acesso não pôde ser alterado. O login continua usando o e-mail anterior; revise o novo endereço e tente novamente.")}`);
    }
  }

  refreshEnrollmentPaths();
  redirect(`/admin/matriculas?sucesso=${encodeURIComponent("Dados da matrícula atualizados mantendo aluno, responsável e vínculos existentes.")}`);
}
