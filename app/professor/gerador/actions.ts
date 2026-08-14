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
const allowedQuestionTypes = new Set([
  "multiple_choice",
  "true_false",
  "open_text",
  "matching",
  "fill_blank",
  "ordering",
  "interpretation",
  "problem",
]);
const outputTypes = new Set(["mission", "quiz", "activity", "material", "assessment", "notebook_pdf"]);

const requestSchema = z.object({
  title: z.string().trim().min(2, "Informe o título da atividade.").max(180),
  outputType: z.string().refine((value) => outputTypes.has(value), "Escolha um formato de saída válido."),
  subjectId: z.string().uuid().optional().or(z.literal("")),
  gradeId: z.string().uuid().optional().or(z.literal("")),
  theme: z.string().trim().max(300).optional(),
  objective: z.string().trim().max(2000).optional(),
  skillText: z.string().trim().max(1000).optional(),
  ageLabel: z.string().trim().max(120).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  desiredQuestionCount: z.coerce.number().int().min(0).max(50),
  estimatedMinutes: z.coerce.number().int().min(1).max(300),
  instructions: z.string().trim().max(50000).optional(),
  notes: z.string().trim().max(5000).optional(),
  sourceFilePath: z.string().trim().max(500).optional(),
  sourceFileName: z.string().trim().max(220).optional(),
  sourceMimeType: z.string().trim().max(180).optional(),
  sourceFileSize: z.coerce.number().int().min(0).max(MAX_FILE_BYTES).optional(),
});

const generatedQuestionSchema = z.object({
  questionType: z.string().refine((value) => allowedQuestionTypes.has(value)),
  prompt: z.string().trim().min(2).max(5000),
  options: z.array(z.string().trim().max(1200)).max(12),
  correctValue: z.string().trim().max(3000),
  explanation: z.string().trim().max(5000),
  hint: z.string().trim().max(3000),
});

function selectedValues(formData: FormData, key: string, allowed: Set<string>) {
  return [...new Set(formData.getAll(key).map(String).filter((value) => allowed.has(value)))];
}

function cleanOptional(value?: string) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function generatorFail(message: string): never {
  redirect(`/professor/gerador?erro=${encodeURIComponent(message)}`);
}

function extractOutputText(result: any) {
  if (typeof result?.output_text === "string" && result.output_text.trim()) return result.output_text.trim();
  for (const item of result?.output ?? []) {
    if (item?.type !== "message") continue;
    for (const part of item?.content ?? []) {
      if (part?.type === "output_text" && typeof part.text === "string" && part.text.trim()) return part.text.trim();
    }
  }
  return "";
}

function outputLabel(value: string) {
  if (value === "mission") return "Missão";
  if (value === "quiz") return "Quiz";
  if (value === "activity") return "Atividade";
  if (value === "material") return "Material";
  if (value === "assessment") return "Avaliação";
  return "Caderno";
}

function questionTypeLabel(value: string) {
  const labels: Record<string, string> = {
    multiple_choice: "múltipla escolha",
    true_false: "verdadeiro ou falso",
    open_text: "discursiva",
    matching: "associação",
    fill_blank: "complete a frase",
    ordering: "ordenação",
    interpretation: "interpretação",
    problem: "situação-problema",
  };
  return labels[value] || value;
}

async function removeUploadedSource(supabase: any, sourceFilePath: string | null) {
  if (!sourceFilePath) return;
  await supabase.storage.from("generation-sources").remove([sourceFilePath]);
}

export async function generateTeacherActivity(formData: FormData) {
  const { teacher, supabase, viewer } = await getCurrentTeacher();
  if (!teacher) generatorFail("Seu perfil de professor ainda não está completo.");

  const parsed = requestSchema.safeParse({
    title: formData.get("title"),
    outputType: formData.get("outputType"),
    subjectId: String(formData.get("subjectId") || ""),
    gradeId: String(formData.get("gradeId") || ""),
    theme: String(formData.get("theme") || ""),
    objective: String(formData.get("objective") || ""),
    skillText: String(formData.get("skillText") || ""),
    ageLabel: String(formData.get("ageLabel") || ""),
    difficulty: formData.get("difficulty") || "medium",
    desiredQuestionCount: formData.get("desiredQuestionCount") || 10,
    estimatedMinutes: formData.get("estimatedMinutes") || 20,
    instructions: String(formData.get("instructions") || ""),
    notes: String(formData.get("notes") || ""),
    sourceFilePath: String(formData.get("sourceFilePath") || ""),
    sourceFileName: String(formData.get("sourceFileName") || ""),
    sourceMimeType: String(formData.get("sourceMimeType") || ""),
    sourceFileSize: formData.get("sourceFileSize") || 0,
  });
  if (!parsed.success) generatorFail(parsed.error.issues[0]?.message || "Revise os dados da geração.");

  const sourceFilePath = cleanOptional(parsed.data.sourceFilePath);
  const sourceFileName = cleanOptional(parsed.data.sourceFileName);
  const sourceMimeType = cleanOptional(parsed.data.sourceMimeType);
  const sourceFileSize = Number(parsed.data.sourceFileSize || 0);

  if (sourceFilePath && !sourceFilePath.startsWith(`${viewer.user.id}/`)) generatorFail("Arquivo de origem inválido.");
  if (sourceFilePath && (!sourceMimeType || !allowedMimeTypes.has(sourceMimeType))) {
    await removeUploadedSource(supabase, sourceFilePath);
    generatorFail("O arquivo deve ser PDF, DOCX, PPTX, TXT, PNG, JPG ou WEBP.");
  }
  if (sourceFilePath && sourceFileSize > MAX_FILE_BYTES) {
    await removeUploadedSource(supabase, sourceFilePath);
    generatorFail("O arquivo deve ter até 15 MB.");
  }

  const qTypes = selectedValues(formData, "questionTypes", allowedQuestionTypes);
  const requestedQuestionTypes = qTypes.length ? qTypes : ["multiple_choice", "open_text"];
  const includeExplanations = formData.get("includeExplanations") === "on";
  const includeHints = formData.get("includeHints") === "on";
  const count = parsed.data.desiredQuestionCount;

  let filePart: Record<string, string> | null = null;
  if (sourceFilePath) {
    const { data: fileBlob, error: downloadError } = await supabase.storage.from("generation-sources").download(sourceFilePath);
    if (downloadError || !fileBlob) {
      await removeUploadedSource(supabase, sourceFilePath);
      generatorFail("Não foi possível ler o arquivo enviado. Tente anexá-lo novamente.");
    }
    const base64 = Buffer.from(await fileBlob.arrayBuffer()).toString("base64");
    const dataUrl = `data:${sourceMimeType};base64,${base64}`;
    filePart = sourceMimeType?.startsWith("image/")
      ? { type: "input_image", image_url: dataUrl, detail: "auto" }
      : { type: "input_file", filename: sourceFileName || "fonte", file_data: dataUrl };
  }

  const prompt = [
    "Você é um assistente de preparação pedagógica para professores. Gere um RASCUNHO editável em português do Brasil.",
    "Nunca publique, atribua ou envie nada ao aluno. A decisão final e a revisão pertencem ao professor.",
    `Formato solicitado: ${outputLabel(parsed.data.outputType)}.`,
    `Título obrigatório, que deve ser preservado pelo sistema: ${parsed.data.title}.`,
    parsed.data.theme ? `Tema: ${parsed.data.theme}.` : "",
    parsed.data.objective ? `Objetivo definido pelo professor: ${parsed.data.objective}.` : "",
    parsed.data.skillText ? `Habilidade indicada: ${parsed.data.skillText}.` : "",
    parsed.data.ageLabel ? `Faixa etária: ${parsed.data.ageLabel}.` : "",
    `Dificuldade: ${parsed.data.difficulty}.`,
    `Duração estimada: ${parsed.data.estimatedMinutes} minutos.`,
    `Gere exatamente ${count} questão(ões).`,
    `Use somente estes tipos quando houver questões: ${requestedQuestionTypes.map(questionTypeLabel).join(", ")}.`,
    includeExplanations ? "Preencha uma explicação clara da resposta para cada questão." : "Deixe explanation como string vazia em todas as questões.",
    includeHints ? "Preencha uma pista curta para cada questão, sem entregar diretamente a resposta." : "Deixe hint como string vazia em todas as questões.",
    "Para múltipla escolha, crie alternativas plausíveis e apenas uma resposta correta. Para verdadeiro/falso, use as opções Verdadeiro e Falso.",
    "O campo preparedText deve conter o conteúdo-base já organizado para o professor revisar e reaproveitar em material, atividade, avaliação ou caderno.",
    "Não invente informações factuais que contradigam a fonte anexada. Se a fonte trouxer conteúdo, priorize-a.",
    parsed.data.instructions ? `Instruções e/ou fonte em texto fornecida pelo professor:\n${parsed.data.instructions}` : "",
    parsed.data.notes ? `Observações adicionais:\n${parsed.data.notes}` : "",
  ].filter(Boolean).join("\n\n");

  const questionSchema = {
    type: "object",
    additionalProperties: false,
    required: ["questionType", "prompt", "options", "correctValue", "explanation", "hint"],
    properties: {
      questionType: { type: "string", enum: requestedQuestionTypes },
      prompt: { type: "string" },
      options: { type: "array", items: { type: "string" }, maxItems: 12 },
      correctValue: { type: "string" },
      explanation: { type: "string" },
      hint: { type: "string" },
    },
  };

  const responseSchema = {
    type: "object",
    additionalProperties: false,
    required: ["theme", "objective", "skillText", "ageLabel", "estimatedMinutes", "preparedText", "questions"],
    properties: {
      theme: { type: "string" },
      objective: { type: "string" },
      skillText: { type: "string" },
      ageLabel: { type: "string" },
      estimatedMinutes: { type: "integer" },
      preparedText: { type: "string" },
      questions: { type: "array", minItems: count, maxItems: count, items: questionSchema },
    },
  };

  const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  if (!apiKey) {
    await removeUploadedSource(supabase, sourceFilePath);
    generatorFail("O gerador automático ainda não recebeu uma credencial do provedor de IA neste ambiente.");
  }

  const content: any[] = [{ type: "input_text", text: prompt }];
  if (filePart) content.push(filePart);

  let gatewayResponse: Response;
  try {
    gatewayResponse = await fetch("https://ai-gateway.vercel.sh/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        store: false,
        reasoning: { effort: "medium" },
        max_output_tokens: 32000,
        input: [{ type: "message", role: "user", content }],
        text: {
          format: {
            type: "json_schema",
            name: "teacher_activity_draft",
            strict: true,
            schema: responseSchema,
          },
        },
      }),
      cache: "no-store",
    });
  } catch {
    await removeUploadedSource(supabase, sourceFilePath);
    generatorFail("Não foi possível conectar ao gerador automático. Tente novamente.");
  }

  const gatewayResult = await gatewayResponse.json().catch(() => null);
  if (!gatewayResponse.ok) {
    console.error("teacher_activity_generator_gateway_error", {
      status: gatewayResponse.status,
      code: gatewayResult?.error?.code,
      type: gatewayResult?.error?.type,
    });
    await removeUploadedSource(supabase, sourceFilePath);
    generatorFail("O gerador não conseguiu processar este pedido. Revise o arquivo/instruções e tente novamente.");
  }

  const outputText = extractOutputText(gatewayResult);
  let rawGenerated: unknown;
  try {
    rawGenerated = JSON.parse(outputText);
  } catch {
    await removeUploadedSource(supabase, sourceFilePath);
    generatorFail("A geração terminou, mas o resultado veio em formato inválido. Tente novamente.");
  }

  const generatedSchema = z.object({
    theme: z.string().trim().max(300),
    objective: z.string().trim().max(2000),
    skillText: z.string().trim().max(1000),
    ageLabel: z.string().trim().max(120),
    estimatedMinutes: z.coerce.number().int().min(1).max(300),
    preparedText: z.string().trim().min(1).max(200000),
    questions: z.array(generatedQuestionSchema).length(count),
  });
  const generated = generatedSchema.safeParse(rawGenerated);
  if (!generated.success) {
    console.error("teacher_activity_generator_validation_error", generated.error.issues.slice(0, 5));
    await removeUploadedSource(supabase, sourceFilePath);
    generatorFail("A geração não respeitou o formato solicitado. Tente novamente.");
  }

  const sourceKind = sourceFilePath && parsed.data.instructions ? "mixed" : sourceFilePath ? "file" : "text";
  const preservedSourceText = [
    generated.data.preparedText,
    parsed.data.instructions ? `--- Instruções/fonte originais do professor ---\n${parsed.data.instructions}` : null,
  ].filter(Boolean).join("\n\n").slice(0, 200000);

  const { data: draft, error: draftError } = await supabase.from("content_preparation_drafts").insert({
    created_by_teacher_id: teacher.id,
    created_by_user_id: viewer.user.id,
    title: parsed.data.title,
    source_kind: sourceKind,
    source_text: preservedSourceText,
    source_file_path: sourceFilePath,
    source_file_name: sourceFileName,
    source_mime_type: sourceMimeType,
    subject_id: parsed.data.subjectId || null,
    grade_id: parsed.data.gradeId || null,
    theme: cleanOptional(parsed.data.theme) || cleanOptional(generated.data.theme),
    objective: cleanOptional(parsed.data.objective) || cleanOptional(generated.data.objective),
    skill_text: cleanOptional(parsed.data.skillText) || cleanOptional(generated.data.skillText),
    age_label: cleanOptional(parsed.data.ageLabel) || cleanOptional(generated.data.ageLabel),
    difficulty: parsed.data.difficulty,
    desired_question_count: count,
    question_types: requestedQuestionTypes,
    target_formats: [parsed.data.outputType],
    notes: cleanOptional(parsed.data.notes),
    estimated_minutes: parsed.data.estimatedMinutes || generated.data.estimatedMinutes,
    status: "review",
  }).select("id").single();

  if (draftError || !draft) {
    await removeUploadedSource(supabase, sourceFilePath);
    generatorFail("O conteúdo foi gerado, mas não foi possível salvar o rascunho para revisão.");
  }

  if (generated.data.questions.length) {
    const { error: questionsError } = await supabase.from("content_preparation_questions").insert(
      generated.data.questions.map((question, index) => ({
        draft_id: draft.id,
        position: index + 1,
        question_type: question.questionType,
        prompt: question.prompt,
        options: question.options,
        correct_value: cleanOptional(question.correctValue),
        explanation: includeExplanations ? cleanOptional(question.explanation) : null,
        hint: includeHints ? cleanOptional(question.hint) : null,
      })),
    );
    if (questionsError) {
      await supabase.from("content_preparation_drafts").delete().eq("id", draft.id).eq("created_by_teacher_id", teacher.id);
      await removeUploadedSource(supabase, sourceFilePath);
      generatorFail("O conteúdo foi gerado, mas houve um problema ao salvar as questões.");
    }
  }

  revalidatePath("/professor/gerador");
  revalidatePath("/professor/criar");
  redirect(`/professor/criar/revisao/${draft.id}?sucesso=${encodeURIComponent(`Geração concluída com ${count} questão(ões). Revise tudo antes de escolher os alunos e publicar.`)}`);
}
