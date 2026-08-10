"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentTeacher } from "@/lib/teacher";

const missionSchema = z.object({
  idempotencyKey: z.string().min(8).max(160),
  title: z.string().min(3),
  objective: z.string().min(5),
  estimatedMinutes: z.coerce.number().min(5).max(180),
  subjectId: z.string().uuid().optional().or(z.literal("")),
  skillId: z.string().uuid(),
  prompt: z.string().min(5),
  hint: z.string().optional(),
  questionType: z.enum(["open_text", "multiple_choice", "true_false"]),
  choices: z.string().optional(),
  correctAnswer: z.string().optional(),
});

export async function createMission(formData: FormData) {
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) redirect("/professor/missoes/nova?erro=Perfil+de+professor+incompleto");

  const parsed = missionSchema.safeParse({
    idempotencyKey: formData.get("idempotencyKey"),
    title: formData.get("title"),
    objective: formData.get("objective"),
    estimatedMinutes: formData.get("estimatedMinutes"),
    subjectId: formData.get("subjectId"),
    skillId: formData.get("skillId"),
    prompt: formData.get("prompt"),
    hint: formData.get("hint"),
    questionType: formData.get("questionType"),
    choices: String(formData.get("choices") || ""),
    correctAnswer: String(formData.get("correctAnswer") || ""),
  });

  if (!parsed.success) {
    redirect("/professor/missoes/nova?erro=" + encodeURIComponent(parsed.error.issues[0].message));
  }

  const choices = parsed.data.questionType === "true_false"
    ? ["Verdadeiro", "Falso"]
    : parsed.data.questionType === "multiple_choice"
      ? (parsed.data.choices || "").split(/\r?\n/).map((value) => value.trim()).filter(Boolean).slice(0, 8)
      : [];

  if (parsed.data.questionType === "multiple_choice" && choices.length < 2) {
    redirect("/professor/missoes/nova?erro=" + encodeURIComponent("Informe pelo menos duas alternativas, uma por linha."));
  }

  const correctAnswer = (parsed.data.correctAnswer || "").trim();
  if (parsed.data.questionType !== "open_text" && (!correctAnswer || !choices.includes(correctAnswer))) {
    redirect("/professor/missoes/nova?erro=" + encodeURIComponent("A resposta correta precisa ser exatamente uma das alternativas."));
  }

  const { error } = await supabase.rpc("create_teacher_mission", {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_title: parsed.data.title,
    p_objective: parsed.data.objective,
    p_estimated_minutes: parsed.data.estimatedMinutes,
    p_subject_id: parsed.data.subjectId || null,
    p_skill_id: parsed.data.skillId,
    p_prompt: parsed.data.prompt,
    p_hint: parsed.data.hint || "",
    p_question_type: parsed.data.questionType,
    p_options: choices,
    p_correct_answer: correctAnswer,
  });

  if (error) {
    console.error("Falha ao criar Missão Cuca", error.code);
    redirect("/professor/missoes/nova?erro=" + encodeURIComponent("Não foi possível salvar a missão. Nenhum rascunho parcial deve ser mantido; revise os dados e tente novamente."));
  }

  revalidatePath("/professor/missoes");
  redirect("/professor/missoes?sucesso=" + encodeURIComponent("Missão criada como rascunho sem duplicação."));
}

export async function assignMission(formData: FormData) {
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) redirect("/professor/missoes");

  const missionId = String(formData.get("missionId") || "");
  const studentId = String(formData.get("studentId") || "");
  const dueAt = String(formData.get("dueAt") || "");

  const { error } = await supabase.rpc("assign_mission_to_student", {
    p_mission_id: missionId,
    p_student_id: studentId,
    p_due_at: dueAt ? new Date(`${dueAt}T23:59:59`).toISOString() : null,
  });

  if (error) redirect("/professor/missoes?erro=" + encodeURIComponent(error.message));

  revalidatePath("/professor/missoes");
  redirect("/professor/missoes?sucesso=" + encodeURIComponent("Missão publicada para o aluno."));
}

const missionManageSchema = z.object({
  missionId: z.string().uuid(),
  title: z.string().min(3).max(160).optional(),
  objective: z.string().min(5).max(1000).optional(),
  estimatedMinutes: z.coerce.number().int().min(5).max(180).optional(),
});

export async function updateMission(formData: FormData) {
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) redirect("/professor/missoes");
  const parsed = missionManageSchema.safeParse({
    missionId: formData.get("missionId"),
    title: formData.get("title"),
    objective: formData.get("objective"),
    estimatedMinutes: formData.get("estimatedMinutes"),
  });
  if (!parsed.success) redirect(`/professor/missoes?erro=${encodeURIComponent("Revise os dados da missão.")}`);
  const { error } = await supabase.from("missions").update({
    title: parsed.data.title,
    objective: parsed.data.objective,
    estimated_minutes: parsed.data.estimatedMinutes,
    updated_at: new Date().toISOString(),
  }).eq("id", parsed.data.missionId).eq("created_by_teacher_id", teacher.id);
  if (error) redirect(`/professor/missoes?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/professor/missoes");
  redirect(`/professor/missoes?sucesso=${encodeURIComponent("Missão atualizada.")}`);
}

export async function archiveMission(formData: FormData) {
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) redirect("/professor/missoes");
  const missionId = String(formData.get("missionId") || "");
  if (!z.string().uuid().safeParse(missionId).success) return;
  const { error } = await supabase.from("missions").update({ status: "archived", updated_at: new Date().toISOString() }).eq("id", missionId).eq("created_by_teacher_id", teacher.id);
  if (error) redirect(`/professor/missoes?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/professor/missoes");
  redirect(`/professor/missoes?sucesso=${encodeURIComponent("Missão arquivada.")}`);
}

export async function removeMission(formData: FormData) {
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) redirect("/professor/missoes");
  const missionId = String(formData.get("missionId") || "");
  if (!z.string().uuid().safeParse(missionId).success) return;
  const { data: mission } = await supabase.from("missions").select("id,status").eq("id", missionId).eq("created_by_teacher_id", teacher.id).maybeSingle();
  if (!mission) redirect(`/professor/missoes?erro=${encodeURIComponent("Missão não encontrada.")}`);
  const { count } = await supabase.from("mission_students").select("id", { count: "exact", head: true }).eq("mission_id", missionId);
  if (mission.status !== "draft" || (count ?? 0) > 0) {
    await supabase.from("missions").update({ status: "archived", updated_at: new Date().toISOString() }).eq("id", missionId);
    revalidatePath("/professor/missoes");
    redirect(`/professor/missoes?sucesso=${encodeURIComponent("A missão já tinha publicação ou histórico e foi arquivada em vez de apagada.")}`);
  }
  const { error } = await supabase.from("missions").delete().eq("id", missionId).eq("created_by_teacher_id", teacher.id);
  if (error) redirect(`/professor/missoes?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/professor/missoes");
  redirect(`/professor/missoes?sucesso=${encodeURIComponent("Rascunho excluído.")}`);
}
