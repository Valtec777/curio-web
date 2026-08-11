"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const moduleSchema = z.object({
  courseId: z.string().uuid(),
  moduleId: z.string().uuid().optional().or(z.literal("")),
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(1000).optional(),
  body: z.string().trim().max(20000).optional(),
  resourceType: z.enum(["lesson", "video", "link", "download", "practice"]),
  externalUrl: z.string().trim().max(1000).optional(),
  existingFilePath: z.string().trim().max(1000).optional(),
  position: z.coerce.number().int().min(1).max(500),
  durationMinutes: z.coerce.number().int().min(1).max(3000),
  required: z.boolean(),
}).superRefine((value, ctx) => {
  if (value.externalUrl) {
    try {
      const url = new URL(value.externalUrl);
      if (url.protocol !== "https:") throw new Error("https only");
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["externalUrl"], message: "Use um link HTTPS válido." });
    }
  }
});

function safeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 110) || "recurso";
}

function feedback(key: "erro" | "sucesso", message: string) {
  redirect(`/admin/cursos?${key}=${encodeURIComponent(message)}`);
}

export async function saveModoPensarModule(formData: FormData) {
  const viewer = await requireRole("admin");
  const parsed = moduleSchema.safeParse({
    courseId: formData.get("courseId"),
    moduleId: String(formData.get("moduleId") || ""),
    title: formData.get("title"),
    description: String(formData.get("description") || ""),
    body: String(formData.get("body") || ""),
    resourceType: formData.get("resourceType") || "lesson",
    externalUrl: String(formData.get("externalUrl") || ""),
    existingFilePath: String(formData.get("existingFilePath") || ""),
    position: formData.get("position"),
    durationMinutes: formData.get("durationMinutes"),
    required: formData.get("required") === "on",
  });
  if (!parsed.success) feedback("erro", parsed.error.issues[0]?.message || "Revise a etapa do Modo Pensar.");

  const supabase = await createClient();
  const { data: course, error: courseError } = await supabase
    .from("free_courses")
    .select("id,status")
    .eq("id", parsed.data.courseId)
    .maybeSingle();
  if (courseError || !course || course.status === "archived") feedback("erro", "A trilha não está disponível para edição.");

  const fileValue = formData.get("file");
  const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
  let newFilePath: string | null = null;
  if (file) {
    if (file.size > 15 * 1024 * 1024) feedback("erro", "O arquivo da etapa pode ter no máximo 15 MB.");
    if (!allowedMimeTypes.has(file.type)) feedback("erro", "Use PDF, DOCX, PPTX, TXT, PNG, JPG ou WEBP.");
    newFilePath = `${viewer.user.id}/modo-pensar/${parsed.data.courseId}/${Date.now()}-${safeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage.from("generated-documents").upload(newFilePath, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      console.error("Falha ao anexar recurso do Modo Pensar", uploadError.message);
      feedback("erro", "Não foi possível anexar o arquivo da etapa.");
    }
  }

  const payload = {
    course_id: parsed.data.courseId,
    title: parsed.data.title,
    description: parsed.data.description || null,
    body: parsed.data.body || null,
    resource_type: parsed.data.resourceType,
    external_url: parsed.data.externalUrl || null,
    file_path: newFilePath || parsed.data.existingFilePath || null,
    position: parsed.data.position,
    duration_minutes: parsed.data.durationMinutes,
    required: parsed.data.required,
    updated_at: new Date().toISOString(),
  };

  const result = parsed.data.moduleId
    ? await supabase.from("free_course_modules").update(payload).eq("id", parsed.data.moduleId).eq("course_id", parsed.data.courseId).select("id").maybeSingle()
    : await supabase.from("free_course_modules").insert(payload).select("id").single();

  if (result.error || !result.data) {
    if (newFilePath) await supabase.storage.from("generated-documents").remove([newFilePath]);
    console.error("Falha ao salvar etapa do Modo Pensar", result.error?.code);
    feedback("erro", "Não foi possível salvar a etapa. O arquivo novo não foi mantido.");
  }

  const previousFilePath = parsed.data.existingFilePath || null;
  if (newFilePath && previousFilePath && previousFilePath !== newFilePath && previousFilePath.startsWith(`${viewer.user.id}/`)) {
    await supabase.storage.from("generated-documents").remove([previousFilePath]);
  }

  revalidatePath("/admin/cursos");
  revalidatePath("/aluno/modo-pensar");
  feedback("sucesso", parsed.data.moduleId ? "Etapa atualizada." : "Etapa adicionada à trilha.");
}

export async function removeModoPensarModule(formData: FormData) {
  const viewer = await requireRole("admin");
  const parsed = z.object({ moduleId: z.string().uuid(), courseId: z.string().uuid() }).safeParse({
    moduleId: formData.get("moduleId"),
    courseId: formData.get("courseId"),
  });
  if (!parsed.success) feedback("erro", "Não foi possível identificar a etapa.");

  const supabase = await createClient();
  const { data: module, error: moduleError } = await supabase
    .from("free_course_modules")
    .select("id,file_path")
    .eq("id", parsed.data.moduleId)
    .eq("course_id", parsed.data.courseId)
    .maybeSingle();
  if (moduleError || !module) feedback("erro", "Etapa não encontrada.");

  const { count, error: progressError } = await supabase
    .from("free_course_module_progress")
    .select("id", { count: "exact", head: true })
    .eq("module_id", module.id);
  if (progressError) feedback("erro", "Não foi possível verificar o histórico da etapa.");
  if ((count ?? 0) > 0) feedback("erro", "Esta etapa já possui progresso de aluno e não pode ser apagada. Edite o conteúdo em vez de removê-la.");

  const { error } = await supabase.from("free_course_modules").delete().eq("id", module.id);
  if (error) feedback("erro", "Não foi possível excluir a etapa.");

  if (module.file_path && module.file_path.startsWith(`${viewer.user.id}/`)) {
    await supabase.storage.from("generated-documents").remove([module.file_path]);
  }

  revalidatePath("/admin/cursos");
  revalidatePath("/aluno/modo-pensar");
  feedback("sucesso", "Etapa excluída sem apagar histórico de aluno.");
}
