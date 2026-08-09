"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentTeacher } from "@/lib/teacher";

const generationSchema = z.object({
  outputType: z.enum([
    "mission_cuca",
    "caderno_curio",
    "modo_prova",
    "diagnostico_inicial",
    "plano_30_dias",
    "registro_pos_encontro",
    "relatorio_familia",
  ]),
  prompt: z.string().max(12000).optional(),
  titleHint: z.string().max(160).optional(),
  studentId: z.string().uuid().optional().or(z.literal("")),
  gradeId: z.string().uuid().optional().or(z.literal("")),
  subjectId: z.string().uuid().optional().or(z.literal("")),
}).refine((data) => Boolean(data.prompt?.trim()), { message: "Cole um texto/prompt ou anexe um arquivo." });

const allowedMimeTypes = new Set([
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function safeFileName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 110);
}

export async function queueCurioGeneration(formData: FormData) {
  const { teacher, supabase, viewer } = await getCurrentTeacher();
  if (!teacher) redirect("/professor/gerador?erro=Professor+não+vinculado");

  const file = formData.get("sourceFile");
  const hasFile = file instanceof File && file.size > 0;
  const rawPrompt = String(formData.get("prompt") || "");

  const parsed = generationSchema.safeParse({
    outputType: formData.get("outputType"),
    prompt: rawPrompt || (hasFile ? "Arquivo anexado para análise." : ""),
    titleHint: String(formData.get("titleHint") || ""),
    studentId: String(formData.get("studentId") || ""),
    gradeId: String(formData.get("gradeId") || ""),
    subjectId: String(formData.get("subjectId") || ""),
  });

  if (!parsed.success) redirect(`/professor/gerador?erro=${encodeURIComponent(parsed.error.issues[0]?.message || "Revise os campos.")}`);

  let sourceFilePath: string | null = null;
  let sourceFileName: string | null = null;
  let sourceMimeType: string | null = null;

  if (hasFile) {
    if (file.size > 10 * 1024 * 1024) redirect("/professor/gerador?erro=O+arquivo+deve+ter+até+10+MB");
    if (!allowedMimeTypes.has(file.type)) redirect("/professor/gerador?erro=Envie+PDF,+TXT+ou+DOCX");

    const path = `${viewer.user.id}/${crypto.randomUUID()}-${safeFileName(file.name || "fonte.pdf")}`;
    const { error: uploadError } = await supabase.storage.from("generation-sources").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) redirect(`/professor/gerador?erro=${encodeURIComponent("Não foi possível anexar o arquivo: " + uploadError.message)}`);
    sourceFilePath = path;
    sourceFileName = file.name;
    sourceMimeType = file.type;
  }

  const templateContract = parsed.data.outputType === "mission_cuca"
    ? "ATV-01"
    : parsed.data.outputType === "diagnostico_inicial"
      ? "PED-01"
      : parsed.data.outputType === "plano_30_dias"
        ? "PRO-01"
        : parsed.data.outputType === "registro_pos_encontro"
          ? "PED-03"
          : parsed.data.outputType === "relatorio_familia"
            ? "REL-01"
            : parsed.data.outputType === "caderno_curio"
              ? "ATV-01:CADERNO"
              : "MODO-PROVA";

  const outputContract = parsed.data.outputType === "mission_cuca"
    ? { entity: "mission", interaction: "in_app_quiz", output_format: "structured_questions", requires_pdf: false }
    : parsed.data.outputType === "caderno_curio"
      ? { entity: "notebook_activity", interaction: "offline_worksheet", output_format: "print_ready_pdf", requires_pdf: true }
      : parsed.data.outputType === "modo_prova"
        ? { entity: "assessment_review", interaction: "in_app_review", output_format: "structured_questions", requires_pdf: false }
        : { entity: "document_draft", interaction: "review_before_publish", output_format: "structured_document", requires_pdf: false };

  const { error } = await supabase.from("generation_jobs").insert({
    requested_by_user_id: viewer.user.id,
    teacher_id: teacher.id,
    job_type: parsed.data.outputType,
    status: "queued",
    input: {
      prompt: rawPrompt.trim() || null,
      title_hint: parsed.data.titleHint?.trim() || null,
      student_id: parsed.data.studentId || null,
      grade_id: parsed.data.gradeId || null,
      subject_id: parsed.data.subjectId || null,
      source_file_path: sourceFilePath,
      source_file_name: sourceFileName,
      source_mime_type: sourceMimeType,
      template_contract: templateContract,
      output_contract: outputContract,
      teacher_review_required: true,
      auto_publish: false,
      source_policy: "minimum_personal_data",
    },
  });

  if (error) redirect(`/professor/gerador?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/professor/gerador");
  redirect("/professor/gerador?sucesso=Fonte+recebida.+Rascunho+colocado+na+fila+de+geração.");
}
