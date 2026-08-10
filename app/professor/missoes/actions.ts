"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentTeacher } from "@/lib/teacher";

const missionSchema = z.object({
  idempotencyKey: z.string().min(8).max(160),
  title: z.string().min(3),
  objective: z.string().min(5),
  description: z.string().max(2500).optional(),
  estimatedMinutes: z.coerce.number().min(5).max(180),
  subjectId: z.string().uuid().optional().or(z.literal("")),
  gradeId: z.string().uuid().optional().or(z.literal("")),
  characterId: z.string().uuid().optional().or(z.literal("")),
  skillId: z.string().uuid(),
  prompt: z.string().min(5),
  hint: z.string().optional(),
  questionType: z.enum(["open_text", "multiple_choice", "true_false"]),
  choices: z.string().optional(),
  correctAnswer: z.string().optional(),
});

function bahiaDateTime(value?: string | null, endOfDay = false) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T${endOfDay ? "23:59:59" : "00:00:00"}-03:00`).toISOString();
  }
  const normalized = raw.length === 16 ? `${raw}:00` : raw;
  const date = new Date(`${normalized}-03:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function returnPath(formData: FormData) {
  const value = String(formData.get("returnTo") || "");
  return value.startsWith("/professor/criar") ? "/professor/criar" : "/professor/missoes";
}

export async function createMission(formData: FormData) {
  const { teacher, supabase } = await getCurrentTeacher();
  const target = returnPath(formData);
  if (!teacher) redirect(`${target}?erro=${encodeURIComponent("Perfil de professor incompleto.")}`);

  const manualOptions = ["A", "B", "C", "D"]
    .map((letter) => String(formData.get(`option${letter}`) || "").trim())
    .filter(Boolean);
  const selectedOption = String(formData.get("correctOption") || "").trim();
  const selectedIndex = ["A", "B", "C", "D"].indexOf(selectedOption);
  const typedChoices = manualOptions.length ? manualOptions.join("\n") : String(formData.get("choices") || "");
  const typedCorrect = selectedIndex >= 0 && manualOptions[selectedIndex]
    ? manualOptions[selectedIndex]
    : String(formData.get("correctAnswer") || "");

  const parsed = missionSchema.safeParse({
    idempotencyKey: formData.get("idempotencyKey"),
    title: formData.get("title"),
    objective: formData.get("objective"),
    description: String(formData.get("description") || ""),
    estimatedMinutes: formData.get("estimatedMinutes"),
    subjectId: formData.get("subjectId"),
    gradeId: formData.get("gradeId"),
    characterId: formData.get("characterId"),
    skillId: formData.get("skillId"),
    prompt: formData.get("prompt"),
    hint: formData.get("hint"),
    questionType: formData.get("questionType"),
    choices: typedChoices,
    correctAnswer: typedCorrect,
  });

  if (!parsed.success) {
    redirect(`${target}?erro=${encodeURIComponent(parsed.error.issues[0]?.message || "Revise a missão.")}`);
  }

  const choices = parsed.data.questionType === "true_false"
    ? ["Verdadeiro", "Falso"]
    : parsed.data.questionType === "multiple_choice"
      ? (parsed.data.choices || "").split(/\r?\n/).map((value) => value.trim()).filter(Boolean).slice(0, 4)
      : [];

  if (parsed.data.questionType === "multiple_choice" && choices.length !== 4) {
    redirect(`${target}?erro=${encodeURIComponent("Para múltipla escolha, preencha as quatro alternativas.")}`);
  }

  const correctAnswer = (parsed.data.correctAnswer || "").trim();
  if (parsed.data.questionType !== "open_text" && (!correctAnswer || !choices.includes(correctAnswer))) {
    redirect(`${target}?erro=${encodeURIComponent("Marque qual alternativa é a correta.")}`);
  }

  const { data: missionId, error } = await supabase.rpc("create_teacher_mission", {
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

  if (error || !missionId) {
    console.error("Falha ao criar Missão Cuca", error?.code);
    redirect(`${target}?erro=${encodeURIComponent("Não foi possível salvar a missão. Revise os dados e tente novamente.")}`);
  }

  const { error: metadataError } = await supabase
    .from("missions")
    .update({
      description: parsed.data.description?.trim() || null,
      grade_id: parsed.data.gradeId || null,
      character_id: parsed.data.characterId || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", missionId)
    .eq("created_by_teacher_id", teacher.id);

  if (metadataError) {
    redirect(`${target}?erro=${encodeURIComponent("A missão foi salva como rascunho, mas alguns detalhes não puderam ser atualizados.")}`);
  }

  const studentIds = [...new Set(formData.getAll("studentIds").map(String).filter((value) => z.string().uuid().safeParse(value).success))];
  if (studentIds.length) {
    const dueAt = bahiaDateTime(String(formData.get("dueAt") || ""), true);
    const { error: assignmentError } = await supabase.rpc("assign_mission_to_students", {
      p_mission_id: missionId,
      p_student_ids: studentIds,
      p_due_at: dueAt,
    });
    if (assignmentError) {
      redirect(`${target}?erro=${encodeURIComponent("A missão foi criada como rascunho, mas não foi possível publicar para todos os alunos selecionados.")}`);
    }
  }

  revalidatePath("/professor");
  revalidatePath("/professor/missoes");
  revalidatePath("/professor/conteudos");
  revalidatePath("/aluno/missoes");
  const message = studentIds.length
    ? `Missão criada e publicada para ${studentIds.length} aluno(s).`
    : "Missão criada como rascunho.";
  redirect(`${target}?sucesso=${encodeURIComponent(message)}`);
}

export async function assignMission(formData: FormData) {
  const missionId = String(formData.get("missionId") || "");
  const studentId = String(formData.get("studentId") || "");
  const forwarded = new FormData();
  forwarded.set("missionId", missionId);
  forwarded.append("studentIds", studentId);
  forwarded.set("dueAt", String(formData.get("dueAt") || ""));
  return assignMissionMany(forwarded);
}

export async function assignMissionMany(formData: FormData) {
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) redirect("/professor/missoes");

  const missionId = String(formData.get("missionId") || "");
  const studentIds = [...new Set(formData.getAll("studentIds").map(String).filter((value) => z.string().uuid().safeParse(value).success))];
  if (!z.string().uuid().safeParse(missionId).success || !studentIds.length) {
    redirect(`/professor/missoes?erro=${encodeURIComponent("Escolha pelo menos um aluno.")}`);
  }
  const dueAt = bahiaDateTime(String(formData.get("dueAt") || ""), true);

  const { error } = await supabase.rpc("assign_mission_to_students", {
    p_mission_id: missionId,
    p_student_ids: studentIds,
    p_due_at: dueAt,
  });

  if (error) redirect(`/professor/missoes?erro=${encodeURIComponent("Não foi possível publicar a missão para os alunos selecionados.")}`);

  revalidatePath("/professor");
  revalidatePath("/professor/missoes");
  revalidatePath("/aluno/missoes");
  redirect(`/professor/missoes?sucesso=${encodeURIComponent(`Missão publicada para ${studentIds.length} aluno(s).`)}`);
}

export async function duplicateMission(formData: FormData) {
  const missionId = String(formData.get("missionId") || "");
  if (!z.string().uuid().safeParse(missionId).success) return;
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) redirect("/professor/missoes");
  const { error } = await supabase.rpc("duplicate_teacher_mission", { p_mission_id: missionId });
  if (error) redirect(`/professor/missoes?erro=${encodeURIComponent("Não foi possível duplicar a missão.")}`);
  revalidatePath("/professor/missoes");
  revalidatePath("/professor/conteudos");
  redirect(`/professor/missoes?sucesso=${encodeURIComponent("Missão duplicada como novo rascunho, sem alunos vinculados.")}`);
}

const missionManageSchema = z.object({
  missionId: z.string().uuid(),
  title: z.string().min(3).max(160).optional(),
  objective: z.string().min(5).max(1000).optional(),
  description: z.string().max(2500).optional(),
  estimatedMinutes: z.coerce.number().int().min(5).max(180).optional(),
});

export async function updateMission(formData: FormData) {
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) redirect("/professor/missoes");
  const parsed = missionManageSchema.safeParse({
    missionId: formData.get("missionId"),
    title: formData.get("title"),
    objective: formData.get("objective"),
    description: String(formData.get("description") || ""),
    estimatedMinutes: formData.get("estimatedMinutes"),
  });
  if (!parsed.success) redirect(`/professor/missoes?erro=${encodeURIComponent("Revise os dados da missão.")}`);
  const { error } = await supabase.from("missions").update({
    title: parsed.data.title,
    objective: parsed.data.objective,
    description: parsed.data.description?.trim() || null,
    estimated_minutes: parsed.data.estimatedMinutes,
    updated_at: new Date().toISOString(),
  }).eq("id", parsed.data.missionId).eq("created_by_teacher_id", teacher.id);
  if (error) redirect(`/professor/missoes?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/professor/missoes");
  revalidatePath("/professor/conteudos");
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
  revalidatePath("/professor/conteudos");
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
    revalidatePath("/professor/conteudos");
    redirect(`/professor/missoes?sucesso=${encodeURIComponent("A missão já tinha publicação ou histórico e foi arquivada em vez de apagada.")}`);
  }
  const { error } = await supabase.from("missions").delete().eq("id", missionId).eq("created_by_teacher_id", teacher.id);
  if (error) redirect(`/professor/missoes?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/professor/missoes");
  revalidatePath("/professor/conteudos");
  redirect(`/professor/missoes?sucesso=${encodeURIComponent("Rascunho excluído.")}`);
}
