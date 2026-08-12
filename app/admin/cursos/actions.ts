"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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
const courseImportMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);
const imageMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

function safeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 110) || "recurso";
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90) || `trilha-${Date.now()}`;
}

function feedback(key: "erro" | "sucesso", message: string): never {
  redirect(`/admin/cursos?${key}=${encodeURIComponent(message)}`);
}

function httpsUrl(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function fileFrom(formData: FormData, field: string) {
  const value = formData.get(field);
  return value instanceof File && value.size > 0 ? value : null;
}

async function uploadGeneratedFile({
  supabase,
  userId,
  courseId,
  folder,
  file,
}: {
  supabase: any;
  userId: string;
  courseId: string;
  folder: string;
  file: File;
}) {
  if (file.size > MAX_FILE_BYTES) feedback("erro", "Cada arquivo pode ter no máximo 15 MB.");
  if (!allowedMimeTypes.has(file.type)) feedback("erro", "Use PDF, DOCX, PPTX, TXT, PNG, JPG ou WEBP.");
  const path = `${userId}/modo-pensar/${courseId}/${folder}/${Date.now()}-${safeFileName(file.name)}`;
  const { error } = await supabase.storage.from("generated-documents").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) {
    console.error("Falha ao anexar arquivo do Modo Pensar", error.code);
    feedback("erro", "Não foi possível anexar o arquivo.");
  }
  return path;
}

const courseSchema = z.object({
  courseId: z.string().uuid().optional().or(z.literal("")),
  title: z.string().trim().min(2).max(180),
  slug: z.string().trim().max(100).optional(),
  summary: z.string().trim().max(300).optional(),
  description: z.string().trim().max(6000).optional(),
  category: z.string().trim().max(120).optional(),
  audienceLabel: z.string().trim().max(160).optional(),
  ageLabel: z.string().trim().max(120).optional(),
  levelLabel: z.string().trim().max(100).optional(),
  objective: z.string().trim().max(2000).optional(),
  characterId: z.string().uuid().optional().or(z.literal("")),
  estimatedMinutes: z.coerce.number().int().min(1).max(100000),
  sortOrder: z.coerce.number().int().min(0).max(100000).default(0),
  certificateEnabled: z.boolean(),
  certificateTitle: z.string().trim().max(180).optional(),
  signatoryName: z.string().trim().max(180).optional(),
  signatoryRole: z.string().trim().max(180).optional(),
});

function parseCourse(formData: FormData) {
  return courseSchema.safeParse({
    courseId: String(formData.get("courseId") || ""),
    title: formData.get("title"),
    slug: String(formData.get("slug") || ""),
    summary: String(formData.get("summary") || ""),
    description: String(formData.get("description") || ""),
    category: String(formData.get("category") || ""),
    audienceLabel: String(formData.get("audienceLabel") || ""),
    ageLabel: String(formData.get("ageLabel") || ""),
    levelLabel: String(formData.get("levelLabel") || ""),
    objective: String(formData.get("objective") || ""),
    characterId: String(formData.get("characterId") || ""),
    estimatedMinutes: formData.get("estimatedMinutes"),
    sortOrder: formData.get("sortOrder") || 0,
    certificateEnabled: formData.get("certificateEnabled") === "on",
    certificateTitle: String(formData.get("certificateTitle") || ""),
    signatoryName: String(formData.get("signatoryName") || ""),
    signatoryRole: String(formData.get("signatoryRole") || ""),
  });
}

export async function createModoPensarCourse(formData: FormData) {
  const viewer = await requireRole("admin");
  const parsed = parseCourse(formData);
  if (!parsed.success) feedback("erro", parsed.error.issues[0]?.message || "Revise os dados da trilha.");
  const supabase = await createClient();
  const slug = slugify(parsed.data.slug || parsed.data.title);
  const payload = {
    title: parsed.data.title,
    slug,
    summary: parsed.data.summary || null,
    description: parsed.data.description || null,
    category: parsed.data.category || null,
    audience_label: parsed.data.audienceLabel || "Crianças e adolescentes",
    age_label: parsed.data.ageLabel || null,
    level_label: parsed.data.levelLabel || null,
    objective: parsed.data.objective || null,
    character_id: parsed.data.characterId || null,
    estimated_minutes: parsed.data.estimatedMinutes,
    sort_order: parsed.data.sortOrder,
    certificate_enabled: parsed.data.certificateEnabled,
    certificate_config: {
      title: parsed.data.certificateTitle || "Certificado de conclusão",
      signatory_name: parsed.data.signatoryName || null,
      signatory_role: parsed.data.signatoryRole || null,
    },
    status: "draft",
    created_by_user_id: viewer.user.id,
  };
  const { data: course, error } = await supabase.from("free_courses").insert(payload).select("id").single();
  if (error || !course) {
    const message = error?.code === "23505" ? "Já existe uma trilha com esse endereço curto." : "Não foi possível criar a trilha.";
    feedback("erro", message);
  }

  const cover = fileFrom(formData, "cover");
  if (cover) {
    if (!imageMimeTypes.has(cover.type)) feedback("erro", "A capa deve ser PNG, JPG ou WEBP.");
    const path = await uploadGeneratedFile({ supabase, userId: viewer.user.id, courseId: course.id, folder: "capa", file: cover });
    const { error: coverError } = await supabase.from("free_courses").update({ cover_image_path: path }).eq("id", course.id);
    if (coverError) {
      await supabase.storage.from("generated-documents").remove([path]);
      feedback("erro", "A trilha foi criada, mas não foi possível salvar a capa.");
    }
  }

  revalidatePath("/admin/cursos");
  feedback("sucesso", "Trilha criada como rascunho. Agora adicione e revise as etapas.");
}

export async function updateModoPensarCourse(formData: FormData) {
  const viewer = await requireRole("admin");
  const parsed = parseCourse(formData);
  if (!parsed.success || !parsed.data.courseId) feedback("erro", "Não foi possível identificar a trilha.");
  const supabase = await createClient();
  const { data: current } = await supabase.from("free_courses").select("id,cover_image_path,status").eq("id", parsed.data.courseId).maybeSingle();
  if (!current || current.status === "archived") feedback("erro", "Esta trilha não está disponível para edição.");

  let coverPath = current.cover_image_path as string | null;
  let newCoverPath: string | null = null;
  const cover = fileFrom(formData, "cover");
  if (cover) {
    if (!imageMimeTypes.has(cover.type)) feedback("erro", "A capa deve ser PNG, JPG ou WEBP.");
    newCoverPath = await uploadGeneratedFile({ supabase, userId: viewer.user.id, courseId: parsed.data.courseId, folder: "capa", file: cover });
    coverPath = newCoverPath;
  }

  const { error } = await supabase.from("free_courses").update({
    title: parsed.data.title,
    slug: slugify(parsed.data.slug || parsed.data.title),
    summary: parsed.data.summary || null,
    description: parsed.data.description || null,
    category: parsed.data.category || null,
    audience_label: parsed.data.audienceLabel || "Crianças e adolescentes",
    age_label: parsed.data.ageLabel || null,
    level_label: parsed.data.levelLabel || null,
    objective: parsed.data.objective || null,
    character_id: parsed.data.characterId || null,
    estimated_minutes: parsed.data.estimatedMinutes,
    sort_order: parsed.data.sortOrder,
    certificate_enabled: parsed.data.certificateEnabled,
    certificate_config: {
      title: parsed.data.certificateTitle || "Certificado de conclusão",
      signatory_name: parsed.data.signatoryName || null,
      signatory_role: parsed.data.signatoryRole || null,
    },
    cover_image_path: coverPath,
    updated_at: new Date().toISOString(),
  }).eq("id", parsed.data.courseId);
  if (error) {
    if (newCoverPath) await supabase.storage.from("generated-documents").remove([newCoverPath]);
    feedback("erro", error.code === "23505" ? "Já existe outra trilha com esse endereço curto." : "Não foi possível salvar a trilha.");
  }
  if (newCoverPath && current.cover_image_path && String(current.cover_image_path).startsWith(`${viewer.user.id}/`)) {
    await supabase.storage.from("generated-documents").remove([current.cover_image_path]);
  }
  revalidatePath("/admin/cursos");
  revalidatePath("/aluno/modo-pensar");
  feedback("sucesso", "Informações da trilha atualizadas sem apagar o progresso existente.");
}

export async function setModoPensarCourseStatus(formData: FormData) {
  await requireRole("admin");
  const parsed = z.object({ courseId: z.string().uuid(), status: z.enum(["draft", "published", "hidden", "archived"]) }).safeParse({
    courseId: formData.get("courseId"),
    status: formData.get("status"),
  });
  if (!parsed.success) feedback("erro", "Ação de publicação inválida.");
  const supabase = await createClient();
  if (parsed.data.status === "published") {
    const { count, error: countError } = await supabase.from("free_course_modules").select("id", { count: "exact", head: true }).eq("course_id", parsed.data.courseId).eq("status", "published");
    if (countError) feedback("erro", "Não foi possível conferir as etapas publicadas.");
    if (!count) feedback("erro", "Publique pelo menos uma etapa antes de publicar a trilha.");
  }
  const { error } = await supabase.from("free_courses").update({
    status: parsed.data.status,
    published_at: parsed.data.status === "published" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("id", parsed.data.courseId);
  if (error) feedback("erro", "Não foi possível atualizar a situação da trilha.");
  revalidatePath("/admin/cursos");
  revalidatePath("/aluno/modo-pensar");
  feedback("sucesso", parsed.data.status === "published" ? "Trilha publicada." : parsed.data.status === "hidden" ? "Trilha ocultada dos alunos." : parsed.data.status === "archived" ? "Trilha arquivada." : "Trilha voltou para rascunho.");
}

export async function removeOrArchiveModoPensarCourse(formData: FormData) {
  await requireRole("admin");
  const courseId = z.string().uuid().safeParse(formData.get("courseId"));
  if (!courseId.success) feedback("erro", "Trilha inválida.");
  const supabase = await createClient();
  const [{ data: course }, { count, error: countError }] = await Promise.all([
    supabase.from("free_courses").select("id,status").eq("id", courseId.data).maybeSingle(),
    supabase.from("free_course_enrollments").select("id", { count: "exact", head: true }).eq("course_id", courseId.data),
  ]);
  if (!course) feedback("erro", "Trilha não encontrada.");
  if (countError) feedback("erro", "Não foi possível conferir o histórico da trilha.");
  if (course.status !== "draft" || (count ?? 0) > 0) {
    const { error } = await supabase.from("free_courses").update({ status: "archived", updated_at: new Date().toISOString() }).eq("id", courseId.data);
    if (error) feedback("erro", "Não foi possível arquivar a trilha.");
    revalidatePath("/admin/cursos");
    revalidatePath("/aluno/modo-pensar");
    feedback("sucesso", "A trilha possui histórico e foi arquivada em vez de apagada.");
  }
  const { error } = await supabase.from("free_courses").delete().eq("id", courseId.data);
  if (error) feedback("erro", "Não foi possível excluir o rascunho.");
  revalidatePath("/admin/cursos");
  feedback("sucesso", "Rascunho sem histórico excluído.");
}

const moduleSchema = z.object({
  courseId: z.string().uuid(),
  moduleId: z.string().uuid().optional().or(z.literal("")),
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(1000).optional(),
  body: z.string().trim().max(20000).optional(),
  resourceType: z.enum(["lesson", "video", "link", "download", "practice"]),
  externalUrl: z.string().trim().max(1000).optional(),
  existingFilePath: z.string().trim().max(1000).optional(),
  position: z.coerce.number().int().min(1).max(100000),
  durationMinutes: z.coerce.number().int().min(1).max(3000),
  required: z.boolean(),
  status: z.enum(["draft", "published", "hidden", "archived"]),
});

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
    status: formData.get("status") || "draft",
  });
  if (!parsed.success) feedback("erro", parsed.error.issues[0]?.message || "Revise a etapa do Modo Pensar.");
  if (parsed.data.externalUrl && !httpsUrl(parsed.data.externalUrl)) feedback("erro", "Use um link HTTPS válido.");

  const supabase = await createClient();
  const { data: course, error: courseError } = await supabase.from("free_courses").select("id,status").eq("id", parsed.data.courseId).maybeSingle();
  if (courseError || !course || course.status === "archived") feedback("erro", "A trilha não está disponível para edição.");

  const file = fileFrom(formData, "file");
  let newFilePath: string | null = null;
  if (file) newFilePath = await uploadGeneratedFile({ supabase, userId: viewer.user.id, courseId: parsed.data.courseId, folder: "etapas", file });

  const payload = {
    course_id: parsed.data.courseId,
    title: parsed.data.title,
    description: parsed.data.description || null,
    body: parsed.data.body || null,
    resource_type: parsed.data.resourceType,
    external_url: httpsUrl(parsed.data.externalUrl),
    file_path: newFilePath || parsed.data.existingFilePath || null,
    position: parsed.data.position,
    duration_minutes: parsed.data.durationMinutes,
    required: parsed.data.required,
    status: parsed.data.status,
    updated_at: new Date().toISOString(),
  };

  const result = parsed.data.moduleId
    ? await supabase.from("free_course_modules").update(payload).eq("id", parsed.data.moduleId).eq("course_id", parsed.data.courseId).select("id").maybeSingle()
    : await supabase.from("free_course_modules").insert(payload).select("id").single();
  if (result.error || !result.data) {
    if (newFilePath) await supabase.storage.from("generated-documents").remove([newFilePath]);
    feedback("erro", result.error?.code === "23505" ? "Já existe outra etapa nessa posição. Reordene ou escolha outra posição." : "Não foi possível salvar a etapa.");
  }

  const previousFilePath = parsed.data.existingFilePath || null;
  if (newFilePath && previousFilePath && previousFilePath !== newFilePath && previousFilePath.startsWith(`${viewer.user.id}/`)) {
    await supabase.storage.from("generated-documents").remove([previousFilePath]);
  }
  revalidatePath("/admin/cursos");
  revalidatePath("/aluno/modo-pensar");
  feedback("sucesso", parsed.data.moduleId ? "Etapa atualizada." : "Etapa adicionada como rascunho.");
}

export async function setModoPensarModuleStatus(formData: FormData) {
  await requireRole("admin");
  const parsed = z.object({ moduleId: z.string().uuid(), status: z.enum(["draft", "published", "hidden", "archived"]) }).safeParse({ moduleId: formData.get("moduleId"), status: formData.get("status") });
  if (!parsed.success) feedback("erro", "Etapa inválida.");
  const supabase = await createClient();
  const { error } = await supabase.from("free_course_modules").update({ status: parsed.data.status, updated_at: new Date().toISOString() }).eq("id", parsed.data.moduleId);
  if (error) feedback("erro", "Não foi possível atualizar a etapa.");
  revalidatePath("/admin/cursos");
  revalidatePath("/aluno/modo-pensar");
  feedback("sucesso", "Situação da etapa atualizada.");
}

export async function duplicateModoPensarModule(formData: FormData) {
  await requireRole("admin");
  const moduleId = z.string().uuid().safeParse(formData.get("moduleId"));
  if (!moduleId.success) feedback("erro", "Etapa inválida.");
  const supabase = await createClient();
  const { data: module } = await supabase.from("free_course_modules").select("course_id,title,description,body,resource_type,external_url,file_path,duration_minutes,required").eq("id", moduleId.data).maybeSingle();
  if (!module) feedback("erro", "Etapa não encontrada.");
  const { data: tail } = await supabase.from("free_course_modules").select("position").eq("course_id", module.course_id).order("position", { ascending: false }).limit(1).maybeSingle();
  const { data: copy, error } = await supabase.from("free_course_modules").insert({
    ...module,
    title: `${module.title} — cópia`,
    position: Number(tail?.position || 0) + 1,
    status: "draft",
  }).select("id").single();
  if (error || !copy) feedback("erro", "Não foi possível duplicar a etapa.");
  const { data: blocks } = await supabase.from("free_course_module_blocks").select("block_type,title,body,external_url,file_path,linked_mission_id,position,config").eq("module_id", moduleId.data).order("position");
  if (blocks?.length) {
    const { error: blockError } = await supabase.from("free_course_module_blocks").insert(blocks.map((block: any) => ({ ...block, module_id: copy.id, status: "draft" })));
    if (blockError) feedback("erro", "A etapa foi duplicada, mas os blocos não puderam ser copiados.");
  }
  revalidatePath("/admin/cursos");
  feedback("sucesso", "Etapa duplicada como rascunho. O progresso da etapa original foi preservado.");
}

export async function moveModoPensarModule(formData: FormData) {
  await requireRole("admin");
  const parsed = z.object({ moduleId: z.string().uuid(), direction: z.enum(["up", "down"]) }).safeParse({ moduleId: formData.get("moduleId"), direction: formData.get("direction") });
  if (!parsed.success) feedback("erro", "Movimento inválido.");
  const supabase = await createClient();
  const { data: current } = await supabase.from("free_course_modules").select("id,course_id,position").eq("id", parsed.data.moduleId).maybeSingle();
  if (!current) feedback("erro", "Etapa não encontrada.");
  let query = supabase.from("free_course_modules").select("id,position").eq("course_id", current.course_id);
  query = parsed.data.direction === "up" ? query.lt("position", current.position).order("position", { ascending: false }) : query.gt("position", current.position).order("position", { ascending: true });
  const { data: adjacent } = await query.limit(1).maybeSingle();
  if (!adjacent) feedback("sucesso", "A etapa já está no limite da ordem.");
  const tempPosition = Math.max(current.position, adjacent.position) + 1000000;
  const a = await supabase.from("free_course_modules").update({ position: tempPosition }).eq("id", current.id);
  const b = !a.error ? await supabase.from("free_course_modules").update({ position: current.position }).eq("id", adjacent.id) : { error: a.error } as any;
  const c = !b.error ? await supabase.from("free_course_modules").update({ position: adjacent.position }).eq("id", current.id) : { error: b.error } as any;
  if (a.error || b.error || c.error) feedback("erro", "Não foi possível reordenar a etapa. Atualize a página e tente novamente.");
  revalidatePath("/admin/cursos");
  revalidatePath("/aluno/modo-pensar");
  feedback("sucesso", "Ordem das etapas atualizada.");
}

export async function addCourseFilesAsModules(formData: FormData) {
  const viewer = await requireRole("admin");
  const courseId = z.string().uuid().safeParse(formData.get("courseId"));
  if (!courseId.success) feedback("erro", "Trilha inválida.");
  const files = formData.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
  if (!files.length) feedback("erro", "Escolha pelo menos um PDF, DOCX ou PPTX.");
  if (files.length > 20) feedback("erro", "Envie no máximo 20 arquivos por vez.");
  const supabase = await createClient();
  const { data: course } = await supabase.from("free_courses").select("id,status").eq("id", courseId.data).maybeSingle();
  if (!course || course.status === "archived") feedback("erro", "Trilha indisponível para edição.");
  const { data: tail } = await supabase.from("free_course_modules").select("position").eq("course_id", courseId.data).order("position", { ascending: false }).limit(1).maybeSingle();
  let position = Number(tail?.position || 0);
  let created = 0;
  for (const file of files) {
    if (!courseImportMimeTypes.has(file.type)) feedback("erro", `O arquivo ${file.name} não é PDF, DOCX ou PPTX.`);
    if (file.size > MAX_FILE_BYTES) feedback("erro", `O arquivo ${file.name} ultrapassa 15 MB.`);
    const path = await uploadGeneratedFile({ supabase, userId: viewer.user.id, courseId: courseId.data, folder: "importacao", file });
    position += 1;
    const title = file.name.replace(/\.(pdf|docx|pptx)$/i, "").replace(/[-_]+/g, " ").trim() || `Etapa ${position}`;
    const { error } = await supabase.from("free_course_modules").insert({
      course_id: courseId.data,
      title,
      description: "Arquivo importado. Abra a etapa para adicionar texto, vídeo, quiz ou atividade.",
      resource_type: "download",
      file_path: path,
      position,
      duration_minutes: 10,
      required: true,
      status: "draft",
    });
    if (error) {
      await supabase.storage.from("generated-documents").remove([path]);
      feedback("erro", `Não foi possível criar a etapa a partir de ${file.name}.`);
    }
    created += 1;
  }
  revalidatePath("/admin/cursos");
  feedback("sucesso", `${created} arquivo(s) viraram etapas em rascunho. Revise cada uma antes de publicar.`);
}

export async function removeModoPensarModule(formData: FormData) {
  const viewer = await requireRole("admin");
  const parsed = z.object({ moduleId: z.string().uuid(), courseId: z.string().uuid() }).safeParse({ moduleId: formData.get("moduleId"), courseId: formData.get("courseId") });
  if (!parsed.success) feedback("erro", "Não foi possível identificar a etapa.");
  const supabase = await createClient();
  const { data: module, error: moduleError } = await supabase.from("free_course_modules").select("id,file_path").eq("id", parsed.data.moduleId).eq("course_id", parsed.data.courseId).maybeSingle();
  if (moduleError || !module) feedback("erro", "Etapa não encontrada.");
  const { count, error: progressError } = await supabase.from("free_course_module_progress").select("id", { count: "exact", head: true }).eq("module_id", module.id);
  if (progressError) feedback("erro", "Não foi possível verificar o histórico da etapa.");
  if ((count ?? 0) > 0) feedback("erro", "Esta etapa já possui progresso de aluno. Oculte ou arquive em vez de apagar.");
  const { error } = await supabase.from("free_course_modules").delete().eq("id", module.id);
  if (error) feedback("erro", "Não foi possível excluir a etapa.");
  if (module.file_path && module.file_path.startsWith(`${viewer.user.id}/`)) await supabase.storage.from("generated-documents").remove([module.file_path]);
  revalidatePath("/admin/cursos");
  revalidatePath("/aluno/modo-pensar");
  feedback("sucesso", "Etapa sem progresso excluída.");
}

const blockSchema = z.object({
  blockId: z.string().uuid().optional().or(z.literal("")),
  moduleId: z.string().uuid(),
  blockType: z.enum(["text", "image", "video", "link", "download", "quiz", "activity", "button"]),
  title: z.string().trim().max(180).optional(),
  body: z.string().trim().max(20000).optional(),
  externalUrl: z.string().trim().max(1000).optional(),
  existingFilePath: z.string().trim().max(1000).optional(),
  linkedMissionId: z.string().uuid().optional().or(z.literal("")),
  position: z.coerce.number().int().min(1).max(100000),
  status: z.enum(["draft", "published", "hidden", "archived"]),
  buttonLabel: z.string().trim().max(80).optional(),
});

export async function saveModoPensarBlock(formData: FormData) {
  const viewer = await requireRole("admin");
  const parsed = blockSchema.safeParse({
    blockId: String(formData.get("blockId") || ""),
    moduleId: formData.get("moduleId"),
    blockType: formData.get("blockType") || "text",
    title: String(formData.get("title") || ""),
    body: String(formData.get("body") || ""),
    externalUrl: String(formData.get("externalUrl") || ""),
    existingFilePath: String(formData.get("existingFilePath") || ""),
    linkedMissionId: String(formData.get("linkedMissionId") || ""),
    position: formData.get("position"),
    status: formData.get("status") || "draft",
    buttonLabel: String(formData.get("buttonLabel") || ""),
  });
  if (!parsed.success) feedback("erro", parsed.error.issues[0]?.message || "Revise o bloco.");
  if (parsed.data.externalUrl && !httpsUrl(parsed.data.externalUrl)) feedback("erro", "Use um link HTTPS válido.");
  const supabase = await createClient();
  const { data: module } = await supabase.from("free_course_modules").select("id,course_id").eq("id", parsed.data.moduleId).maybeSingle();
  if (!module) feedback("erro", "Etapa não encontrada.");
  if ((parsed.data.blockType === "quiz" || parsed.data.blockType === "activity") && !parsed.data.linkedMissionId) feedback("erro", "Escolha uma Missão/Quiz existente para este bloco.");
  if (parsed.data.linkedMissionId) {
    const { data: mission } = await supabase.from("missions").select("id,status").eq("id", parsed.data.linkedMissionId).neq("status", "archived").maybeSingle();
    if (!mission) feedback("erro", "A Missão/Quiz escolhida não está disponível.");
  }
  const file = fileFrom(formData, "file");
  let newFilePath: string | null = null;
  if (file) newFilePath = await uploadGeneratedFile({ supabase, userId: viewer.user.id, courseId: module.course_id, folder: `blocos/${module.id}`, file });
  const payload = {
    module_id: parsed.data.moduleId,
    block_type: parsed.data.blockType,
    title: parsed.data.title || null,
    body: parsed.data.body || null,
    external_url: httpsUrl(parsed.data.externalUrl),
    file_path: newFilePath || parsed.data.existingFilePath || null,
    linked_mission_id: parsed.data.linkedMissionId || null,
    position: parsed.data.position,
    status: parsed.data.status,
    config: { button_label: parsed.data.buttonLabel || null },
    updated_at: new Date().toISOString(),
  };
  const result = parsed.data.blockId
    ? await supabase.from("free_course_module_blocks").update(payload).eq("id", parsed.data.blockId).eq("module_id", parsed.data.moduleId).select("id").maybeSingle()
    : await supabase.from("free_course_module_blocks").insert(payload).select("id").single();
  if (result.error || !result.data) {
    if (newFilePath) await supabase.storage.from("generated-documents").remove([newFilePath]);
    feedback("erro", result.error?.code === "23505" ? "Já existe outro bloco nessa posição." : "Não foi possível salvar o bloco.");
  }
  if (newFilePath && parsed.data.existingFilePath && parsed.data.existingFilePath.startsWith(`${viewer.user.id}/`)) await supabase.storage.from("generated-documents").remove([parsed.data.existingFilePath]);
  revalidatePath("/admin/cursos");
  revalidatePath("/aluno/modo-pensar");
  feedback("sucesso", parsed.data.blockId ? "Bloco atualizado." : "Bloco adicionado como rascunho.");
}

export async function setModoPensarBlockStatus(formData: FormData) {
  await requireRole("admin");
  const parsed = z.object({ blockId: z.string().uuid(), status: z.enum(["draft", "published", "hidden", "archived"]) }).safeParse({ blockId: formData.get("blockId"), status: formData.get("status") });
  if (!parsed.success) feedback("erro", "Bloco inválido.");
  const supabase = await createClient();
  const { error } = await supabase.from("free_course_module_blocks").update({ status: parsed.data.status, updated_at: new Date().toISOString() }).eq("id", parsed.data.blockId);
  if (error) feedback("erro", "Não foi possível atualizar o bloco.");
  revalidatePath("/admin/cursos");
  revalidatePath("/aluno/modo-pensar");
  feedback("sucesso", "Situação do bloco atualizada.");
}

export async function removeModoPensarBlock(formData: FormData) {
  const viewer = await requireRole("admin");
  const blockId = z.string().uuid().safeParse(formData.get("blockId"));
  if (!blockId.success) feedback("erro", "Bloco inválido.");
  const supabase = await createClient();
  const { data: block } = await supabase.from("free_course_module_blocks").select("id,file_path").eq("id", blockId.data).maybeSingle();
  if (!block) feedback("erro", "Bloco não encontrado.");
  const { error } = await supabase.from("free_course_module_blocks").delete().eq("id", block.id);
  if (error) feedback("erro", "Não foi possível excluir o bloco.");
  if (block.file_path && block.file_path.startsWith(`${viewer.user.id}/`)) await supabase.storage.from("generated-documents").remove([block.file_path]);
  revalidatePath("/admin/cursos");
  revalidatePath("/aluno/modo-pensar");
  feedback("sucesso", "Bloco excluído.");
}
