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

const studentTeacherLinkSchema = z.object({
  studentId: z.string().uuid(),
  teacherId: z.string().uuid(),
});

const studentGuardianLinkSchema = z.object({
  studentId: z.string().uuid(),
  guardianId: z.string().uuid(),
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
    deleted_at: null,
  });

  if (error) redirect("/admin/alunos?erro=" + encodeURIComponent(error.message));

  revalidatePath("/admin/alunos");
  redirect("/admin/alunos?sucesso=" + encodeURIComponent("Aluno criado."));
}

export async function linkTeacher(formData: FormData) {
  await requireRole("admin");
  const parsed = studentTeacherLinkSchema.safeParse({
    studentId: formData.get("studentId"),
    teacherId: formData.get("teacherId"),
  });
  if (!parsed.success) {
    redirect("/admin/alunos?erro=" + encodeURIComponent("Selecione um aluno e um professor válidos."));
  }

  const supabase = await createClient();
  const { error } = await supabase.from("teacher_students").upsert(
    { student_id: parsed.data.studentId, teacher_id: parsed.data.teacherId, active: true },
    { onConflict: "teacher_id,student_id" }
  );

  if (error) redirect("/admin/alunos?erro=" + encodeURIComponent(error.message));
  revalidatePath("/admin/alunos");
}

export async function linkGuardian(formData: FormData) {
  await requireRole("admin");
  const parsed = studentGuardianLinkSchema.safeParse({
    studentId: formData.get("studentId"),
    guardianId: formData.get("guardianId"),
  });
  if (!parsed.success) {
    redirect("/admin/alunos?erro=" + encodeURIComponent("Selecione um aluno e um responsável válidos."));
  }

  const supabase = await createClient();
  const { error } = await supabase.from("guardian_students").upsert(
    {
      student_id: parsed.data.studentId,
      guardian_id: parsed.data.guardianId,
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
  }).eq("id", parsed.data.studentId).is("deleted_at", null);
  if (error) redirect("/admin/alunos?erro=" + encodeURIComponent(error.message));
  revalidatePath("/admin/alunos"); revalidatePath("/familia"); revalidatePath("/aluno");
  redirect("/admin/alunos?sucesso=" + encodeURIComponent("Aluno atualizado."));
}

export async function setStudentStatus(formData: FormData) {
  await requireRole("admin");
  const parsed = z.object({ studentId: z.string().uuid(), status: z.enum(["active","paused","inactive","pilot"]) }).safeParse({ studentId: formData.get("studentId"), status: formData.get("status") });
  if (!parsed.success) {
    redirect("/admin/alunos?erro=" + encodeURIComponent("Não foi possível identificar o aluno ou a situação escolhida."));
  }
  const supabase = await createClient();
  const { error } = await supabase.from("students").update({ status: parsed.data.status, updated_at: new Date().toISOString() }).eq("id", parsed.data.studentId).is("deleted_at", null);
  if (error) redirect("/admin/alunos?erro=" + encodeURIComponent(error.message));
  revalidatePath("/admin/alunos");
  redirect("/admin/alunos?sucesso=" + encodeURIComponent(parsed.data.status === "inactive" ? "Aluno retirado do acesso ativo. O histórico foi preservado." : parsed.data.status === "active" ? "Aluno reativado." : "Situação do aluno atualizada."));
}

export async function moveStudentToTrash(formData: FormData) {
  const viewer = await requireRole("admin");
  const parsed = z.object({
    studentId: z.string().uuid(),
    reason: z.string().max(300).optional(),
  }).safeParse({
    studentId: formData.get("studentId"),
    reason: String(formData.get("reason") || ""),
  });
  if (!parsed.success) {
    redirect("/admin/alunos?erro=" + encodeURIComponent("Não foi possível identificar o aluno que deve ser excluído."));
  }

  const supabase = await createClient();
  const { data: student } = await supabase
    .from("students")
    .select("id,full_name,preferred_name,school_name,grade_id,status,deleted_at")
    .eq("id", parsed.data.studentId)
    .maybeSingle();

  if (!student || student.deleted_at) {
    redirect("/admin/alunos?erro=" + encodeURIComponent("Aluno não encontrado ou já removido."));
  }

  const [teacherLinks, guardianLinks, missionLinks, assessmentLinks] = await Promise.all([
    supabase.from("teacher_students").select("student_id", { count: "exact", head: true }).eq("student_id", student.id),
    supabase.from("guardian_students").select("student_id", { count: "exact", head: true }).eq("student_id", student.id),
    supabase.from("mission_students").select("student_id", { count: "exact", head: true }).eq("student_id", student.id),
    supabase.from("assessment_students").select("student_id", { count: "exact", head: true }).eq("student_id", student.id),
  ]);

  const now = new Date();
  const reason = parsed.data.reason?.trim() || "Removido pelo Admin";
  const { error: trashError } = await supabase.from("trash_items").insert({
    entity_type: "students",
    entity_id: student.id,
    entity_snapshot: {
      label: student.preferred_name || student.full_name,
      full_name: student.full_name,
      school_name: student.school_name,
      grade_id: student.grade_id,
      previous_status: student.status,
      reason,
      dependencies: {
        teacher_students: teacherLinks.count ?? 0,
        guardian_students: guardianLinks.count ?? 0,
        mission_students: missionLinks.count ?? 0,
        assessment_students: assessmentLinks.count ?? 0,
      },
    },
    deleted_by_user_id: viewer.user.id,
    deleted_at: now.toISOString(),
    restore_until: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });

  if (trashError && trashError.code !== "23505") {
    redirect("/admin/alunos?erro=" + encodeURIComponent("Não foi possível enviar o aluno para a Lixeira."));
  }

  const { error } = await supabase.from("students").update({
    status: "inactive",
    deleted_at: now.toISOString(),
    deleted_by_user_id: viewer.user.id,
    delete_reason: reason,
    updated_at: now.toISOString(),
  }).eq("id", student.id).is("deleted_at", null);

  if (error) redirect("/admin/alunos?erro=" + encodeURIComponent("Não foi possível excluir o aluno da operação."));

  revalidatePath("/admin/alunos");
  revalidatePath("/admin/matriculas");
  revalidatePath("/admin/lixeira");
  revalidatePath("/professor/alunos");
  revalidatePath("/familia");
  revalidatePath("/aluno");
  redirect("/admin/alunos?sucesso=" + encodeURIComponent("Aluno enviado para a Lixeira. Vínculos e histórico foram preservados."));
}
