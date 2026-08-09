"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

const studentSchema = z.object({
  fullName: z.string().min(2),
  preferredName: z.string().min(1),
  gradeId: z.string().uuid().optional().or(z.literal("")),
  schoolName: z.string().optional(),
});

export async function createStudent(formData: FormData) {
  await requireRole("admin");

  const parsed = studentSchema.safeParse({
    fullName: formData.get("fullName"),
    preferredName: formData.get("preferredName"),
    gradeId: formData.get("gradeId"),
    schoolName: formData.get("schoolName"),
  });

  if (!parsed.success) {
    redirect("/admin/alunos?erro=" + encodeURIComponent("Confira os dados do aluno."));
  }

  const supabase = await createClient();
  const { error } = await supabase.from("students").insert({
    full_name: parsed.data.fullName,
    preferred_name: parsed.data.preferredName,
    grade_id: parsed.data.gradeId || null,
    school_name: parsed.data.schoolName || null,
    status: "active",
  });

  if (error) redirect("/admin/alunos?erro=" + encodeURIComponent(error.message));

  revalidatePath("/admin/alunos");
  redirect("/admin/alunos?sucesso=" + encodeURIComponent("Aluno criado."));
}

export async function linkTeacher(formData: FormData) {
  await requireRole("admin");
  const studentId = String(formData.get("studentId") || "");
  const teacherId = String(formData.get("teacherId") || "");

  const supabase = await createClient();
  const { error } = await supabase.from("teacher_students").upsert(
    { student_id: studentId, teacher_id: teacherId, active: true },
    { onConflict: "teacher_id,student_id" }
  );

  if (error) redirect("/admin/alunos?erro=" + encodeURIComponent(error.message));
  revalidatePath("/admin/alunos");
}

export async function linkGuardian(formData: FormData) {
  await requireRole("admin");
  const studentId = String(formData.get("studentId") || "");
  const guardianId = String(formData.get("guardianId") || "");

  const supabase = await createClient();
  const { error } = await supabase.from("guardian_students").upsert(
    {
      student_id: studentId,
      guardian_id: guardianId,
      relationship: "responsável",
      can_view_progress: true,
      can_manage_access: true,
    },
    { onConflict: "guardian_id,student_id" }
  );

  if (error) redirect("/admin/alunos?erro=" + encodeURIComponent(error.message));
  revalidatePath("/admin/alunos");
}

export async function updateStudent(formData: FormData) {
  await requireRole("admin");
  const parsed = studentSchema.extend({ studentId: z.string().uuid() }).safeParse({
    studentId: formData.get("studentId"), fullName: formData.get("fullName"), preferredName: formData.get("preferredName"),
    gradeId: String(formData.get("gradeId") || ""), schoolName: String(formData.get("schoolName") || ""),
  });
  if (!parsed.success) redirect("/admin/alunos?erro=" + encodeURIComponent("Confira os dados do aluno."));
  const supabase = await createClient();
  const { error } = await supabase.from("students").update({
    full_name: parsed.data.fullName.trim(), preferred_name: parsed.data.preferredName.trim(), grade_id: parsed.data.gradeId || null,
    school_name: parsed.data.schoolName?.trim() || null, updated_at: new Date().toISOString(),
  }).eq("id", parsed.data.studentId);
  if (error) redirect("/admin/alunos?erro=" + encodeURIComponent(error.message));
  revalidatePath("/admin/alunos"); revalidatePath("/familia"); revalidatePath("/aluno");
  redirect("/admin/alunos?sucesso=" + encodeURIComponent("Aluno atualizado."));
}

export async function setStudentStatus(formData: FormData) {
  await requireRole("admin");
  const parsed = z.object({ studentId: z.string().uuid(), status: z.enum(["active","paused","inactive","pilot"]) }).safeParse({ studentId: formData.get("studentId"), status: formData.get("status") });
  if (!parsed.success) return;
  const supabase = await createClient();
  const { error } = await supabase.from("students").update({ status: parsed.data.status, updated_at: new Date().toISOString() }).eq("id", parsed.data.studentId);
  if (error) redirect("/admin/alunos?erro=" + encodeURIComponent(error.message));
  revalidatePath("/admin/alunos");
  redirect("/admin/alunos?sucesso=" + encodeURIComponent(parsed.data.status === "inactive" ? "Aluno retirado do acesso ativo. O histórico foi preservado." : parsed.data.status === "active" ? "Aluno reativado." : "Situação do aluno atualizada."));
}
