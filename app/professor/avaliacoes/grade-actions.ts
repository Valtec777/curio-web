"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentTeacher } from "@/lib/teacher";

export async function gradeTeacherAssessment(formData: FormData) {
  const parsed = z.object({
    assignmentId: z.string().uuid(),
    studentId: z.string().uuid(),
    score: z.coerce.number().min(0).max(100),
  }).safeParse({
    assignmentId: formData.get("assignmentId"),
    studentId: formData.get("studentId"),
    score: formData.get("score"),
  });
  if (!parsed.success) redirect(`/professor/avaliacoes?erro=${encodeURIComponent("Informe uma nota entre 0 e 100.")}`);

  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) redirect("/professor/avaliacoes");

  const { data: assignment } = await supabase
    .from("assessment_students")
    .select("id,assessment_id,student_id,assessments(created_by_teacher_id)")
    .eq("id", parsed.data.assignmentId)
    .eq("student_id", parsed.data.studentId)
    .maybeSingle();

  const ownerId = assignment?.assessments?.[0]?.created_by_teacher_id;
  if (!assignment || ownerId !== teacher.id) {
    redirect(`/professor/avaliacoes?erro=${encodeURIComponent("Esta avaliação não pertence aos seus alunos.")}`);
  }

  const { error } = await supabase.from("assessment_students").update({
    score: parsed.data.score,
    status: "reviewed",
    reviewed_at: new Date().toISOString(),
  }).eq("id", assignment.id);

  if (error) redirect(`/professor/avaliacoes?erro=${encodeURIComponent("Não foi possível registrar a nota.")}`);
  revalidatePath("/professor/avaliacoes");
  revalidatePath("/familia/avaliacoes");
  revalidatePath("/aluno");
  redirect(`/professor/avaliacoes?sucesso=${encodeURIComponent("Nota registrada.")}`);
}
