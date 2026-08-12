"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentTeacher } from "@/lib/teacher";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const questionTypes = new Set(["multiple_choice", "true_false", "open_text", "matching", "fill_blank", "ordering", "interpretation", "problem"]);
const targetFormats = new Set(["mission", "quiz", "activity", "material", "assessment", "notebook_pdf"]);

function safeFileName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 110) || "fonte";
}

function fail(message: string): never {
  redirect(`/professor/criar?erro=${encodeURIComponent(message)}`);
}

function reviewFail(id: string, message: string): never {
  redirect(`/professor/criar/revisao/${id}?erro=${encodeURIComponent(message)}`);
}

function selectedValues(formData: FormData, key: string, allowed: Set<string>) {
  return [...new Set(formData.getAll(key).map(String).filter((value) => allowed.has(value)))];
}

export async function createContentPreparationDraft(formData: FormData) {
  const { teacher, supabase, viewer } = await getCurrentTeacher();
  if (!teacher) fail("Seu perfil de professor ainda não está completo.");

  const fileValue = formData.get("sourceFile");
  const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
  const sourceTextRaw = String(formData.get("sourceText") || "").trim();
  if (!file && !sourceTextRaw) fail("Cole um texto ou anexe um arquivo para começar.");
  if (file && (file.size > MAX_FILE_BYTES || !allowedMimeTypes.has(file.type))) fail("A fonte deve ser PDF, DOCX, PPTX, TXT ou imagem de até 15 MB.");

  const parsed = z.object({
    title: z.string().trim().max(180).optional(),
    subjectId: z.string().uuid().optional().or(z.literal("")),
    gradeId: z.string().uuid().optional().or(z.literal("")),
    theme: z.string().trim().max(300).optional(),
    objective: z.string().trim().max(2000).optional(),
    skillText: z.string().trim().max(1000).optional(),
    ageLabel: z.string().trim().max(120).optional(),
    difficulty: z.enum(["easy", "medium", "hard"]),
    desiredQuestionCount: z.coerce.number().int().min(0).max(50),
    estimatedMinutes: z.coerce.number().int().min(1).max(300),
    notes: z.string().trim().max(5000).optional(),
  }).safeParse({
    title: String(formData.get("title") || ""),
    subjectId: String(formData.get("subjectId") || ""),
    gradeId: String(formData.get("gradeId") || ""),
    theme: String(formData.get("theme") || ""),
    objective: String(formData.get("objective") || ""),
    skillText: String(formData.get("skillText") || ""),
    ageLabel: String(formData.get("ageLabel") || ""),
    difficulty: formData.get("difficulty") || "medium",
    desiredQuestionCount: formData.get("desiredQuestionCount") || 10,
    estimatedMinutes: formData.get("estimatedMinutes") || 20,
    notes: String(formData.get("notes") || ""),
  });
  if (!parsed.success) fail(parsed.error.issues[0]?.message || "Revise as informações do conteúdo.");

  let sourceFilePath: string | null = null;
  let sourceText = sourceTextRaw || null;
  if (file) {
    sourceFilePath = `${viewer.user.id}/content-preparation/${Date.now()}-${safeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage.from("generation-sources").upload(sourceFilePath, file, { contentType: file.type, upsert: false });
    if (uploadError) fail("Não foi possível anexar a fonte.");
    if (file.type === "text/plain") {
      const fileText = (await file.text()).trim().slice(0, 200000);
      sourceText = [sourceTextRaw, fileText].filter(Boolean).join("\n\n") || null;
    }
  }

  const qTypes = selectedValues(formData, "questionTypes", questionTypes);
  const formats = selectedValues(formData, "targetFormats", targetFormats);
  const sourceKind = file && sourceTextRaw ? "mixed" : file ? "file" : "text";
  const fallbackTitle = parsed.data.title || parsed.data.theme || (file ? file.name.replace(/\.[^.]+$/, "") : "Novo conteúdo");
  const { data: draft, error } = await supabase.from("content_preparation_drafts").insert({
    created_by_teacher_id: teacher.id,
    created_by_user_id: viewer.user.id,
    title: fallbackTitle,
    source_kind: sourceKind,
    source_text: sourceText,
    source_file_path: sourceFilePath,
    source_file_name: file?.name || null,
    source_mime_type: file?.type || null,
    subject_id: parsed.data.subjectId || null,
    grade_id: parsed.data.gradeId || null,
    theme: parsed.data.theme || null,
    objective: parsed.data.objective || null,
    skill_text: parsed.data.skillText || null,
    age_label: parsed.data.ageLabel || null,
    difficulty: parsed.data.difficulty,
    desired_question_count: parsed.data.desiredQuestionCount,
    question_types: qTypes,
    target_formats: formats,
    notes: parsed.data.notes || null,
    estimated_minutes: parsed.data.estimatedMinutes,
    status: "review",
  }).select("id").single();
  if (error || !draft) {
    if (sourceFilePath) await supabase.storage.from("generation-sources").remove([sourceFilePath]);
    fail("Não foi possível criar o rascunho de preparação.");
  }

  revalidatePath("/professor/criar");
  redirect(`/professor/criar/revisao/${draft.id}?sucesso=${encodeURIComponent("Fonte salva. Revise o conteúdo antes de transformar em material pedagógico.")}`);
}

const draftUpdateSchema = z.object({
  draftId: z.string().uuid(),
  title: z.string().trim().min(2).max(180),
  subjectId: z.string().uuid().optional().or(z.literal("")),
  gradeId: z.string().uuid().optional().or(z.literal("")),
  theme: z.string().trim().max(300).optional(),
  objective: z.string().trim().max(2000).optional(),
  skillText: z.string().trim().max(1000).optional(),
  ageLabel: z.string().trim().max(120).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  desiredQuestionCount: z.coerce.number().int().min(0).max(50),
  estimatedMinutes: z.coerce.number().int().min(1).max(300),
  notes: z.string().trim().max(5000).optional(),
  sourceText: z.string().max(200000).optional(),
});

export async function updateContentPreparationDraft(formData: FormData) {
  const { teacher, supabase } = await getCurrentTeacher();
  const draftId = String(formData.get("draftId") || "");
  if (!teacher || !z.string().uuid().safeParse(draftId).success) reviewFail(draftId, "Rascunho inválido.");
  const parsed = draftUpdateSchema.safeParse({
    draftId,
    title: formData.get("title"),
    subjectId: String(formData.get("subjectId") || ""),
    gradeId: String(formData.get("gradeId") || ""),
    theme: String(formData.get("theme") || ""),
    objective: String(formData.get("objective") || ""),
    skillText: String(formData.get("skillText") || ""),
    ageLabel: String(formData.get("ageLabel") || ""),
    difficulty: formData.get("difficulty") || "medium",
    desiredQuestionCount: formData.get("desiredQuestionCount") || 0,
    estimatedMinutes: formData.get("estimatedMinutes") || 20,
    notes: String(formData.get("notes") || ""),
    sourceText: String(formData.get("sourceText") || ""),
  });
  if (!parsed.success) reviewFail(draftId, parsed.error.issues[0]?.message || "Revise os dados.");
  const { error } = await supabase.from("content_preparation_drafts").update({
    title: parsed.data.title,
    subject_id: parsed.data.subjectId || null,
    grade_id: parsed.data.gradeId || null,
    theme: parsed.data.theme || null,
    objective: parsed.data.objective || null,
    skill_text: parsed.data.skillText || null,
    age_label: parsed.data.ageLabel || null,
    difficulty: parsed.data.difficulty,
    desired_question_count: parsed.data.desiredQuestionCount,
    question_types: selectedValues(formData, "questionTypes", questionTypes),
    target_formats: selectedValues(formData, "targetFormats", targetFormats),
    notes: parsed.data.notes || null,
    source_text: parsed.data.sourceText?.trim() || null,
    estimated_minutes: parsed.data.estimatedMinutes,
    status: "review",
    updated_at: new Date().toISOString(),
  }).eq("id", draftId).eq("created_by_teacher_id", teacher.id);
  if (error) reviewFail(draftId, "Não foi possível salvar o rascunho.");
  revalidatePath(`/professor/criar/revisao/${draftId}`);
  redirect(`/professor/criar/revisao/${draftId}?sucesso=${encodeURIComponent("Rascunho atualizado.")}`);
}

const questionSchema = z.object({
  draftId: z.string().uuid(),
  questionId: z.string().uuid().optional().or(z.literal("")),
  position: z.coerce.number().int().min(1).max(1000),
  questionType: z.enum(["multiple_choice", "true_false", "open_text", "matching", "fill_blank", "ordering", "interpretation", "problem"]),
  prompt: z.string().trim().min(2).max(5000),
  options: z.string().max(10000).optional(),
  correctValue: z.string().trim().max(3000).optional(),
  explanation: z.string().trim().max(5000).optional(),
  hint: z.string().trim().max(3000).optional(),
});

export async function saveContentPreparationQuestion(formData: FormData) {
  const { teacher, supabase } = await getCurrentTeacher();
  const parsed = questionSchema.safeParse({
    draftId: formData.get("draftId"),
    questionId: String(formData.get("questionId") || ""),
    position: formData.get("position"),
    questionType: formData.get("questionType") || "open_text",
    prompt: formData.get("prompt"),
    options: String(formData.get("options") || ""),
    correctValue: String(formData.get("correctValue") || ""),
    explanation: String(formData.get("explanation") || ""),
    hint: String(formData.get("hint") || ""),
  });
  const draftId = String(formData.get("draftId") || "");
  if (!teacher || !parsed.success) reviewFail(draftId, parsed.success ? "Professor não identificado." : parsed.error.issues[0]?.message || "Revise a questão.");
  const { data: draft } = await supabase.from("content_preparation_drafts").select("id").eq("id", parsed.data.draftId).eq("created_by_teacher_id", teacher.id).maybeSingle();
  if (!draft) reviewFail(parsed.data.draftId, "Rascunho não encontrado.");
  const options = (parsed.data.options || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 12);
  const payload = {
    draft_id: parsed.data.draftId,
    position: parsed.data.position,
    question_type: parsed.data.questionType,
    prompt: parsed.data.prompt,
    options,
    correct_value: parsed.data.correctValue || null,
    explanation: parsed.data.explanation || null,
    hint: parsed.data.hint || null,
    updated_at: new Date().toISOString(),
  };
  const result = parsed.data.questionId
    ? await supabase.from("content_preparation_questions").update(payload).eq("id", parsed.data.questionId).eq("draft_id", parsed.data.draftId)
    : await supabase.from("content_preparation_questions").insert(payload);
  if (result.error) reviewFail(parsed.data.draftId, result.error.code === "23505" ? "Já existe outra questão nessa posição." : "Não foi possível salvar a questão.");
  revalidatePath(`/professor/criar/revisao/${parsed.data.draftId}`);
  redirect(`/professor/criar/revisao/${parsed.data.draftId}?sucesso=${encodeURIComponent(parsed.data.questionId ? "Questão atualizada." : "Questão adicionada.")}`);
}

export async function removeContentPreparationQuestion(formData: FormData) {
  const { teacher, supabase } = await getCurrentTeacher();
  const parsed = z.object({ draftId: z.string().uuid(), questionId: z.string().uuid() }).safeParse({ draftId: formData.get("draftId"), questionId: formData.get("questionId") });
  const draftId = String(formData.get("draftId") || "");
  if (!teacher || !parsed.success) reviewFail(draftId, "Questão inválida.");
  const { data: draft } = await supabase.from("content_preparation_drafts").select("id").eq("id", parsed.data.draftId).eq("created_by_teacher_id", teacher.id).maybeSingle();
  if (!draft) reviewFail(parsed.data.draftId, "Rascunho não encontrado.");
  const { error } = await supabase.from("content_preparation_questions").delete().eq("id", parsed.data.questionId).eq("draft_id", parsed.data.draftId);
  if (error) reviewFail(parsed.data.draftId, "Não foi possível excluir a questão.");
  revalidatePath(`/professor/criar/revisao/${parsed.data.draftId}`);
  redirect(`/professor/criar/revisao/${parsed.data.draftId}?sucesso=${encodeURIComponent("Questão removida do rascunho.")}`);
}

export async function archiveContentPreparationDraft(formData: FormData) {
  const { teacher, supabase } = await getCurrentTeacher();
  const draftId = z.string().uuid().safeParse(formData.get("draftId"));
  if (!teacher || !draftId.success) fail("Rascunho inválido.");
  const { error } = await supabase.from("content_preparation_drafts").update({ status: "archived", updated_at: new Date().toISOString() }).eq("id", draftId.data).eq("created_by_teacher_id", teacher.id);
  if (error) fail("Não foi possível arquivar o rascunho.");
  revalidatePath("/professor/criar");
  redirect(`/professor/criar?sucesso=${encodeURIComponent("Rascunho arquivado sem apagar os conteúdos finais já criados.")}`);
}
