"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentTeacher } from "@/lib/teacher";
import { planLimitErrorMessage } from "@/lib/plan-usage";

const baseSchema = z.object({
  idempotencyKey: z.string().min(8).max(160),
  title: z.string().trim().min(3).max(180),
  objective: z.string().trim().min(5).max(1600),
  description: z.string().trim().max(3000).optional(),
  estimatedMinutes: z.coerce.number().int().min(5).max(180),
  subjectId: z.string().uuid().optional().or(z.literal("")),
  gradeId: z.string().uuid().optional().or(z.literal("")),
  characterId: z.string().uuid().optional().or(z.literal("")),
  skillId: z.string().uuid(),
  questionCount: z.coerce.number().int().min(1).max(20),
  sourceDraftId: z.string().uuid().optional().or(z.literal("")),
  sourceOutputType: z.enum(["mission", "quiz"]).default("mission"),
});

type QuestionType = "multiple_choice" | "true_false" | "open_text";
type MissionQuestionInput = { position: number; type: QuestionType; prompt: string; hint: string; options: string[]; correctAnswer: string; referenceAnswer: string };

function bahiaDueDate(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const date = new Date(`${raw}T23:59:59-03:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function questionFromForm(formData: FormData, index: number): MissionQuestionInput | null {
  const typeValue = String(formData.get(`q${index}Type`) || "multiple_choice");
  if (!["multiple_choice", "true_false", "open_text"].includes(typeValue)) return null;
  const type = typeValue as QuestionType;
  const prompt = String(formData.get(`q${index}Prompt`) || "").trim();
  const hint = String(formData.get(`q${index}Hint`) || "").trim();
  if (prompt.length < 3) return null;
  if (type === "open_text") return { position: index + 1, type, prompt, hint, options: [], correctAnswer: "", referenceAnswer: String(formData.get(`q${index}ReferenceAnswer`) || "").trim() };
  if (type === "true_false") {
    const answer = String(formData.get(`q${index}CorrectOption`) || "");
    if (!(["Verdadeiro", "Falso"] as string[]).includes(answer)) return null;
    return { position: index + 1, type, prompt, hint, options: ["Verdadeiro", "Falso"], correctAnswer: answer, referenceAnswer: "" };
  }
  const letters = ["A", "B", "C", "D"] as const;
  const options = letters.map((letter) => String(formData.get(`q${index}Option${letter}`) || "").trim());
  if (options.some((option) => option.length < 1)) return null;
  const correctLetter = String(formData.get(`q${index}CorrectOption`) || "");
  const correctIndex = letters.indexOf(correctLetter as (typeof letters)[number]);
  if (correctIndex < 0) return null;
  return { position: index + 1, type, prompt, hint, options, correctAnswer: options[correctIndex], referenceAnswer: "" };
}

export async function createMissionWithQuestions(formData: FormData) {
  const parsed = baseSchema.safeParse({
    idempotencyKey: formData.get("idempotencyKey"),
    title: formData.get("title"),
    objective: formData.get("objective"),
    description: String(formData.get("description") || ""),
    estimatedMinutes: formData.get("estimatedMinutes"),
    subjectId: String(formData.get("subjectId") || ""),
    gradeId: String(formData.get("gradeId") || ""),
    characterId: String(formData.get("characterId") || ""),
    skillId: formData.get("skillId"),
    questionCount: formData.get("questionCount"),
    sourceDraftId: String(formData.get("sourceDraftId") || ""),
    sourceOutputType: formData.get("sourceOutputType") || "mission",
  });
  if (!parsed.success) redirect(`/professor/missoes/nova?erro=${encodeURIComponent("Revise os dados gerais da missão.")}`);

  const questions = Array.from({ length: parsed.data.questionCount }, (_, index) => questionFromForm(formData, index));
  if (questions.some((question) => !question)) redirect(`/professor/missoes/nova?erro=${encodeURIComponent("Revise todas as questões. Múltipla escolha precisa de 4 alternativas e uma resposta correta.")}`);
  const normalizedQuestions = questions as MissionQuestionInput[];

  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) redirect("/professor/missoes");
  if (parsed.data.sourceDraftId) {
    const { data: sourceDraft } = await supabase.from("content_preparation_drafts").select("id").eq("id", parsed.data.sourceDraftId).eq("created_by_teacher_id", teacher.id).maybeSingle();
    if (!sourceDraft) redirect(`/professor/missoes/nova?erro=${encodeURIComponent("O rascunho de origem não está disponível para esta conta.")}`);
  }

  const studentIds = [...new Set(formData.getAll("studentIds").map(String).filter((value) => z.string().uuid().safeParse(value).success))];
  if (studentIds.length) {
    const { data: linked } = await supabase.from("teacher_students").select("student_id,students(deleted_at)").eq("teacher_id", teacher.id).eq("active", true).in("student_id", studentIds);
    const allowed = new Set((linked ?? []).filter((item: any) => item.students && !item.students.deleted_at).map((item: any) => item.student_id));
    if (studentIds.some((studentId) => !allowed.has(studentId))) redirect(`/professor/missoes/nova?erro=${encodeURIComponent("Um dos alunos selecionados não está mais ativo. Atualize a página e escolha um aluno disponível.")}`);
  }

  const first = normalizedQuestions[0];
  const { data: missionId, error: missionError } = await supabase.rpc("create_teacher_mission", {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_title: parsed.data.title,
    p_objective: parsed.data.objective,
    p_estimated_minutes: parsed.data.estimatedMinutes,
    p_subject_id: parsed.data.subjectId || null,
    p_skill_id: parsed.data.skillId,
    p_prompt: first.prompt,
    p_hint: first.hint,
    p_question_type: first.type,
    p_options: first.options,
    p_correct_answer: first.correctAnswer,
  });
  if (missionError || !missionId) {
    console.error("Falha ao criar missão com várias questões", missionError?.code);
    redirect(`/professor/missoes/nova?erro=${encodeURIComponent("Não foi possível criar a missão.")}`);
  }

  const { error: metadataError } = await supabase.from("missions").update({ description: parsed.data.description || null, grade_id: parsed.data.gradeId || null, character_id: parsed.data.characterId || null, updated_at: new Date().toISOString() }).eq("id", missionId).eq("created_by_teacher_id", teacher.id);
  if (metadataError) redirect(`/professor/missoes/nova?erro=${encodeURIComponent("A missão foi criada, mas os detalhes adicionais não puderam ser salvos.")}`);

  const questionRows = normalizedQuestions.map((question) => ({ mission_id: missionId, position: question.position, prompt: question.prompt, hint: question.hint || null, question_type: question.type, options: question.options, primary_skill_id: parsed.data.skillId }));
  const { data: savedQuestions, error: questionsError } = await supabase.from("mission_questions").upsert(questionRows, { onConflict: "mission_id,position" }).select("id,position");
  if (questionsError || (savedQuestions ?? []).length !== normalizedQuestions.length) redirect(`/professor/missoes/nova?erro=${encodeURIComponent("A missão foi salva como rascunho, mas nem todas as questões puderam ser registradas.")}`);
  await supabase.from("mission_questions").delete().eq("mission_id", missionId).gt("position", normalizedQuestions.length);

  const savedByPosition = new Map((savedQuestions ?? []).map((question: any) => [Number(question.position), question.id]));
  for (const question of normalizedQuestions) {
    const questionId = savedByPosition.get(question.position);
    if (!questionId) continue;
    const keyValue = question.type === "open_text" ? question.referenceAnswer : question.correctAnswer;
    if (!keyValue) {
      await supabase.from("mission_question_answer_keys").delete().eq("question_id", questionId);
      continue;
    }
    const { error: keyError } = await supabase.from("mission_question_answer_keys").upsert({ question_id: questionId, correct_value: keyValue }, { onConflict: "question_id" });
    if (keyError) redirect(`/professor/missoes/nova?erro=${encodeURIComponent("As questões foram salvas, mas um gabarito de referência não pôde ser registrado.")}`);
  }

  if (parsed.data.sourceDraftId) {
    const { error: outputError } = await supabase.from("content_preparation_outputs").upsert({ draft_id: parsed.data.sourceDraftId, output_type: parsed.data.sourceOutputType, output_id: missionId }, { onConflict: "draft_id,output_type" });
    if (!outputError) await supabase.from("content_preparation_drafts").update({ status: "converted", updated_at: new Date().toISOString() }).eq("id", parsed.data.sourceDraftId).eq("created_by_teacher_id", teacher.id);
  }

  if (studentIds.length) {
    const { error: assignmentError } = await supabase.rpc("assign_mission_to_students", { p_mission_id: missionId, p_student_ids: studentIds, p_due_at: bahiaDueDate(String(formData.get("dueAt") || "")) });
    if (assignmentError) {
      console.error("Falha ao publicar missão para alunos", assignmentError.code);
      const planMessage = planLimitErrorMessage(assignmentError);
      redirect(`/professor/missoes?erro=${encodeURIComponent(planMessage || "A missão ficou salva como rascunho, mas não foi publicada. Revise os alunos selecionados e tente novamente.")}`);
    }
  }

  revalidatePath("/professor");
  revalidatePath("/professor/criar");
  if (parsed.data.sourceDraftId) revalidatePath(`/professor/criar/revisao/${parsed.data.sourceDraftId}`);
  revalidatePath("/professor/missoes");
  revalidatePath("/professor/limites");
  revalidatePath("/professor/conteudos");
  revalidatePath("/aluno/missoes");
  const typeLabel = parsed.data.sourceOutputType === "quiz" ? "Quiz" : "Missão";
  redirect(`/professor/missoes?sucesso=${encodeURIComponent(studentIds.length ? `${typeLabel} com ${normalizedQuestions.length} questão(ões) publicado para ${studentIds.length} aluno(s).` : `${typeLabel} com ${normalizedQuestions.length} questão(ões) salvo como rascunho.`)}`);
}
