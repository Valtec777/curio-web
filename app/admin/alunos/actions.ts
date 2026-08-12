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
  const { data: student } = await supabase.from("students").select("id").eq("id", parsed.data.studentId).is("deleted_at", null).maybeSingle();
  const { data: teacher } = await supabase.from("teachers").select("id").eq("id", parsed.data.teacherId).eq("active", true).maybeSingle();
  if (!student || !teacher) {
    redirect("/admin/alunos?erro=" + encodeURIComponent("O aluno ou professor selecionado não está ativo."));
  }

  const { error } = await supabase.from("teacher_students").upsert(
    { student_id: parsed.data.studentId, teacher_id: parsed.data.teacherId, active: true },
    { onConflict: "teacher_id,student_id" }
  );

  if (error) redirect("/admin/alunos?erro=" + encodeURIComponent(error.message));
  revalidatePath("/admin/alunos");
  revalidatePath("/professor/alunos");
  redirect("/admin/alunos?sucesso=" + encodeURIComponent("Professor vinculado ao aluno."));
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
  const { data: student } = await supabase.from("students").select("id").eq("id", parsed.data.studentId).is("deleted_at", null).maybeSingle();
  const { data: guardian } = await supabase.from("guardians").select("id").eq("id", parsed.data.guardianId).eq("active", true).maybeSingle();
  if (!student || !guardian) {
    redirect("/admin/alunos?erro=" + encodeURIComponent("O aluno ou responsável selecionado não está ativo."));
  }

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
  revalidatePath("/familia");
  redirect("/admin/alunos?sucesso=" + encodeURIComponent("Responsável vinculado ao aluno."));
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
  await requireRole("admin");
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
  const { error } = await supabase.rpc("move_admin_student_to_trash", {
    p_student_id: parsed.data.studentId,
    p_reason: parsed.data.reason?.trim() || null,
  });

  if (error) {
    console.error("Falha ao mover aluno para a Lixeira", error.code);
    redirect("/admin/alunos?erro=" + encodeURIComponent("Não foi possível enviar o aluno para a Lixeira. Nenhum novo cadastro foi criado; tente novamente."));
  }

  revalidatePath("/admin/alunos");
  revalidatePath("/admin/matriculas");
  revalidatePath("/admin/lixeira");
  revalidatePath("/professor/alunos");
  revalidatePath("/professor/missoes");
  revalidatePath("/familia");
  revalidatePath("/aluno");
  redirect("/admin/alunos?sucesso=" + encodeURIComponent("Aluno enviado para a Lixeira. Professor foi desativado para esse cadastro e todo o histórico foi preservado por 30 dias."));
}
