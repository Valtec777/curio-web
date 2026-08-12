"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentStudent } from "@/lib/student";

export async function submitMission(formData: FormData) {
  const { student, supabase } = await getCurrentStudent();
  if (!student) redirect("/aluno");

  const missionStudentId = String(formData.get("missionStudentId") || "");

  const { data: assignment } = await supabase
    .from("mission_students")
    .select("id,mission_id,student_id,status")
    .eq("id", missionStudentId)
    .eq("student_id", student.id)
    .single();

  if (!assignment) redirect("/aluno/missoes");
  if (assignment.status === "submitted" || assignment.status === "reviewed") redirect("/aluno/missoes");

  const { data: questions } = await supabase
    .from("mission_questions")
    .select("id")
    .eq("mission_id", assignment.mission_id)
    .order("position");

  const { data: submission, error } = await supabase
    .from("submissions")
    .insert({
      mission_student_id: assignment.id,
      student_id: student.id,
      status: "submitted",
      review_status: "pending",
      submitted_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !submission) {
    redirect(`/aluno/missoes/${missionStudentId}?erro=` + encodeURIComponent(error?.message || "Não foi possível enviar."));
  }

  const answers = (questions ?? []).map((q) => ({
    submission_id: submission.id,
    question_id: q.id,
    answer_text: String(formData.get(`answer_${q.id}`) || ""),
  }));

  if (answers.length) {
    const { error: answerError } = await supabase.from("answers").insert(answers);
    if (answerError) {
      await supabase.from("submissions").delete().eq("id", submission.id);
      redirect(`/aluno/missoes/${missionStudentId}?erro=` + encodeURIComponent(answerError.message));
    }
  }

  const { data: gradeRows, error: gradeError } = await supabase.rpc("grade_objective_mission_submission", {
    p_submission_id: submission.id,
    p_student_id: student.id,
  });

  if (gradeError) {
    console.error("Falha na correção objetiva da missão", gradeError.code);
  }

  const result = gradeRows?.[0] as { needs_teacher?: number; score_percent?: number | null } | undefined;
  const needsTeacher = Number(result?.needs_teacher || 0) > 0 || Boolean(gradeError);
  const score = result?.score_percent == null ? null : Math.round(Number(result.score_percent));

  const { data: achievementCount, error: achievementError } = await supabase.rpc("refresh_student_achievements", {
    p_student_id: student.id,
  });
  if (achievementError) {
    console.error("Falha ao atualizar conquistas após missão", achievementError.code);
  }
  const newAchievements = achievementError ? 0 : Math.max(0, Number(achievementCount || 0));

  revalidatePath("/aluno");
  revalidatePath("/aluno/missoes");
  revalidatePath("/aluno/conquistas");
  revalidatePath("/professor");
  revalidatePath("/professor/correcoes");

  const message = needsTeacher
    ? "Missão enviada! As questões objetivas foram conferidas e a parte discursiva ficará para o professor revisar."
    : score == null
      ? "Missão enviada!"
      : `Missão enviada e corrigida automaticamente: ${score}% nas questões objetivas.`;

  const query = new URLSearchParams({ sucesso: message, evento: submission.id });
  if (newAchievements > 0) query.set("conquistas", String(newAchievements));
  redirect(`/aluno/missoes?${query.toString()}`);
}
