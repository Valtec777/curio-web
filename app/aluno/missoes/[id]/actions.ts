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
    .select("id, mission_id, student_id, status")
    .eq("id", missionStudentId)
    .eq("student_id", student.id)
    .single();

  if (!assignment) redirect("/aluno/missoes");
  if (assignment.status === "submitted" || assignment.status === "reviewed") {
    redirect("/aluno/missoes");
  }

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

  revalidatePath("/aluno");
  revalidatePath("/aluno/missoes");
  redirect("/aluno/missoes?sucesso=" + encodeURIComponent("Missão enviada! Ela ficará aguardando correção."));
}
