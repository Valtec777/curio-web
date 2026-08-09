"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentTeacher } from "@/lib/teacher";

const reviewSchema = z.object({
  submissionId: z.string().uuid(),
  answerId: z.string().uuid(),
  studentId: z.string().uuid(),
  questionId: z.string().uuid(),
  skillId: z.string().uuid(),
  domainLevel: z.coerce.number().int().min(0).max(4),
  autonomyLevel: z.coerce.number().int().min(0).max(4),
  score: z.coerce.number().min(0).max(1),
  note: z.string().optional(),
});

export async function reviewAnswer(formData: FormData) {
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) redirect("/professor/correcoes");

  const parsed = reviewSchema.safeParse({
    submissionId: formData.get("submissionId"),
    answerId: formData.get("answerId"),
    studentId: formData.get("studentId"),
    questionId: formData.get("questionId"),
    skillId: formData.get("skillId"),
    domainLevel: formData.get("domainLevel"),
    autonomyLevel: formData.get("autonomyLevel"),
    score: formData.get("score"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    redirect("/professor/correcoes?erro=" + encodeURIComponent(parsed.error.issues[0].message));
  }

  const p = parsed.data;

  const { error: answerError } = await supabase
    .from("answers")
    .update({
      score: p.score,
      reviewed_at: new Date().toISOString(),
      reviewed_by_teacher_id: teacher.id,
    })
    .eq("id", p.answerId);

  if (answerError) redirect("/professor/correcoes?erro=" + encodeURIComponent(answerError.message));

  const { error: evidenceError } = await supabase
    .from("pedagogical_evidence")
    .upsert(
      {
        answer_id: p.answerId,
        student_id: p.studentId,
        teacher_id: teacher.id,
        question_id: p.questionId,
        skill_id: p.skillId,
        domain_level: p.domainLevel,
        autonomy_level: p.autonomyLevel,
        score: p.score,
        teacher_note: p.note || null,
        source_type: "mission",
        observed_at: new Date().toISOString(),
      },
      { onConflict: "answer_id,skill_id" }
    );

  if (evidenceError) redirect("/professor/correcoes?erro=" + encodeURIComponent(evidenceError.message));

  const { error: recalcError } = await supabase.rpc("recalculate_student_skill_state", {
    p_student_id: p.studentId,
    p_skill_id: p.skillId,
  });

  if (recalcError) redirect("/professor/correcoes?erro=" + encodeURIComponent(recalcError.message));

  const { count } = await supabase
    .from("answers")
    .select("id", { count: "exact", head: true })
    .eq("submission_id", p.submissionId)
    .is("reviewed_at", null);

  if ((count ?? 0) === 0) {
    await supabase
      .from("submissions")
      .update({ review_status: "reviewed", reviewed_at: new Date().toISOString() })
      .eq("id", p.submissionId);
  }

  revalidatePath("/professor/correcoes");
  revalidatePath(`/professor/alunos/${p.studentId}`);
  redirect("/professor/correcoes?sucesso=" + encodeURIComponent("Evidência registrada e mapa atualizado."));
}
