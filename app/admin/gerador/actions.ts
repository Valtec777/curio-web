"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const outputTypes = ["mission", "notebook", "material", "assessment", "report"] as const;

const schema = z.object({
  outputType: z.enum(outputTypes),
  title: z.string().max(180).optional(),
  theme: z.string().max(220).optional(),
  objective: z.string().max(1200).optional(),
  baseText: z.string().max(20000).optional(),
  questions: z.string().max(12000).optional(),
  teacherId: z.string().uuid().optional().or(z.literal("")),
  studentId: z.string().uuid().optional().or(z.literal("")),
  subjectId: z.string().uuid().optional().or(z.literal("")),
  gradeId: z.string().uuid().optional().or(z.literal("")),
});

const allowedMimeTypes = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

function safeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 110);
}

function dayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bahia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function clean(value?: string | null) {
  const text = String(value || "").trim();
  return text || null;
}

function fingerprint(payload: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function duplicateStorageError(message?: string) {
  const value = String(message || "").toLowerCase();
  return value.includes("already exists") || value.includes("duplicate") || value.includes("resource exists");
}

async function uploadGenerationFile(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  file: File;
  key: string;
  role: "fonte" | "modelo";
}) {
  if (args.file.size > 10 * 1024 * 1024) {
    return { ok: false as const, message: `${args.role === "fonte" ? "A fonte" : "O modelo"} deve ter até 10 MB.` };
  }
  if (!allowedMimeTypes.has(args.file.type)) {
    return { ok: false as const, message: "Use PDF, DOCX, XLSX, CSV ou TXT." };
  }

  const path = `${args.userId}/${dayKey()}-${args.key}-${args.role}-${safeFileName(args.file.name || `${args.role}.pdf`)}`;
  const { error } = await args.supabase.storage.from("generation-sources").upload(path, args.file, {
    contentType: args.file.type,
    upsert: false,
  });
  if (error && !duplicateStorageError(error.message)) {
    return { ok: false as const, message: `Não foi possível anexar ${args.role === "fonte" ? "a fonte" : "o modelo"}.` };
  }
  return { ok: true as const, path };
}

export async function queueAdminGeneration(formData: FormData) {
  const viewer = await requireRole("admin");
  const supabase = await createClient();
  const sourceFile = formData.get("sourceFile");
  const modelFile = formData.get("modelFile");
  const hasSource = sourceFile instanceof File && sourceFile.size > 0;
  const hasModel = modelFile instanceof File && modelFile.size > 0;

  const parsed = schema.safeParse({
    outputType: formData.get("outputType"),
    title: String(formData.get("title") || ""),
    theme: String(formData.get("theme") || ""),
    objective: String(formData.get("objective") || ""),
    baseText: String(formData.get("baseText") || ""),
    questions: String(formData.get("questions") || ""),
    teacherId: String(formData.get("teacherId") || ""),
    studentId: String(formData.get("studentId") || ""),
    subjectId: String(formData.get("subjectId") || ""),
    gradeId: String(formData.get("gradeId") || ""),
  });

  if (!parsed.success) {
    redirect(`/admin/gerador?erro=${encodeURIComponent(parsed.error.issues[0]?.message || "Revise os campos do gerador.")}`);
  }

  const hasWrittenContent = Boolean(
    clean(parsed.data.theme) || clean(parsed.data.objective) || clean(parsed.data.baseText) || clean(parsed.data.questions),
  );
  if (!hasWrittenContent && !hasSource) {
    redirect(`/admin/gerador?erro=${encodeURIComponent("Cole um conteúdo ou anexe uma fonte para transformar.")}`);
  }

  if (parsed.data.studentId && parsed.data.teacherId) {
    const { data: link } = await supabase
      .from("teacher_students")
      .select("student_id")
      .eq("teacher_id", parsed.data.teacherId)
      .eq("student_id", parsed.data.studentId)
      .eq("active", true)
      .maybeSingle();
    if (!link) {
      redirect(`/admin/gerador?erro=${encodeURIComponent("O aluno escolhido não está vinculado ao professor selecionado.")}`);
    }
  }

  const requestPayload = {
    output_type: parsed.data.outputType,
    title: clean(parsed.data.title),
    theme: clean(parsed.data.theme),
    objective: clean(parsed.data.objective),
    base_text: clean(parsed.data.baseText),
    questions: clean(parsed.data.questions),
    teacher_id: parsed.data.teacherId || null,
    student_id: parsed.data.studentId || null,
    subject_id: parsed.data.subjectId || null,
    grade_id: parsed.data.gradeId || null,
    source: hasSource ? { name: sourceFile.name, size: sourceFile.size, type: sourceFile.type } : null,
    model: hasModel ? { name: modelFile.name, size: modelFile.size, type: modelFile.type } : null,
  };
  const key = fingerprint(requestPayload);
  const idempotencyKey = `admin-generation-v1:${key}`;

  const { data: existing } = await supabase
    .from("generation_jobs")
    .select("id,status")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing) {
    redirect(`/admin/gerador?sucesso=${encodeURIComponent("Esse pedido já estava registrado. Nenhuma geração duplicada foi criada.")}`);
  }

  let sourcePath: string | null = null;
  let modelPath: string | null = null;

  if (hasSource) {
    const upload = await uploadGenerationFile({ supabase, userId: viewer.user.id, file: sourceFile, key, role: "fonte" });
    if (!upload.ok) redirect(`/admin/gerador?erro=${encodeURIComponent(upload.message)}`);
    sourcePath = upload.path;
  }

  if (hasModel) {
    const upload = await uploadGenerationFile({ supabase, userId: viewer.user.id, file: modelFile, key, role: "modelo" });
    if (!upload.ok) redirect(`/admin/gerador?erro=${encodeURIComponent(upload.message)}`);
    modelPath = upload.path;
  }

  const outputContract = parsed.data.outputType === "mission"
    ? { product: "mission", interaction: "in_app", requires_pdf: false, teacher_review_required: true }
    : parsed.data.outputType === "notebook"
      ? { product: "notebook_activity", interaction: "print_or_pdf", requires_pdf: true, teacher_review_required: true }
      : parsed.data.outputType === "material"
        ? { product: "material", interaction: "print_or_share", requires_pdf: true, teacher_review_required: true }
        : parsed.data.outputType === "assessment"
          ? { product: "assessment", interaction: "print_or_in_app", requires_pdf: true, teacher_review_required: true }
          : { product: "report", interaction: "document", requires_pdf: true, teacher_review_required: true };

  const { error } = await supabase.from("generation_jobs").insert({
    requested_by_user_id: viewer.user.id,
    teacher_id: parsed.data.teacherId || null,
    job_type: parsed.data.outputType,
    status: "queued",
    idempotency_key: idempotencyKey,
    input: {
      requested_output_type: parsed.data.outputType,
      title_hint: clean(parsed.data.title),
      theme: clean(parsed.data.theme),
      objective: clean(parsed.data.objective),
      base_text: clean(parsed.data.baseText),
      questions_one_per_line: clean(parsed.data.questions),
      student_id: parsed.data.studentId || null,
      subject_id: parsed.data.subjectId || null,
      grade_id: parsed.data.gradeId || null,
      source_file_path: sourcePath,
      source_file_name: hasSource ? sourceFile.name : null,
      source_mime_type: hasSource ? sourceFile.type : null,
      model_file_path: modelPath,
      model_file_name: hasModel ? modelFile.name : null,
      model_mime_type: hasModel ? modelFile.type : null,
      output_contract: outputContract,
      teacher_review_required: true,
      auto_publish: false,
      source_policy: "minimum_personal_data",
    },
  });

  if (error && error.code !== "23505") {
    const remove = [sourcePath, modelPath].filter(Boolean) as string[];
    if (remove.length) await supabase.storage.from("generation-sources").remove(remove);
    redirect(`/admin/gerador?erro=${encodeURIComponent("Não foi possível registrar este pedido agora.")}`);
  }

  revalidatePath("/admin/gerador");
  redirect(`/admin/gerador?sucesso=${encodeURIComponent(error?.code === "23505" ? "Esse pedido já estava registrado. Nenhuma duplicidade foi criada." : "Fonte recebida e transformação registrada para processamento.")}`);
}
