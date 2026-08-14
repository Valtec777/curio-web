"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getFamilyPortal } from "@/lib/family";

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

function familyPath(path: string, studentId: string | null | undefined, key: "erro" | "sucesso", message: string) {
  const params = new URLSearchParams();
  if (studentId) params.set("aluno", studentId);
  params.set(key, message);
  return `${path}?${params.toString()}`;
}

async function removeUpload(supabase: any, path?: string | null) {
  if (!path) return;
  await supabase.storage.from("family-uploads").remove([path]);
}

function fileMetadata(formData: FormData) {
  return {
    filePath: String(formData.get("uploadedFilePath") || "").trim(),
    fileName: String(formData.get("uploadedFileName") || "").trim(),
    mimeType: String(formData.get("uploadedMimeType") || "").trim(),
    fileSize: Number(formData.get("uploadedFileSize") || 0),
  };
}

function validFileMeta(meta: ReturnType<typeof fileMetadata>) {
  return Boolean(
    meta.filePath
    && meta.fileName
    && ALLOWED.has(meta.mimeType)
    && Number.isInteger(meta.fileSize)
    && meta.fileSize > 0
    && meta.fileSize <= MAX_BYTES,
  );
}

export async function registerFamilySchoolContent(formData: FormData) {
  const parsed = z.object({
    studentId: z.string().uuid(),
    title: z.string().trim().min(2).max(180),
    subjectId: z.string().uuid().optional().or(z.literal("")),
    contentType: z.enum(["school_material", "notebook_photo", "school_notice", "assignment", "assessment_notice", "other"]),
    description: z.string().trim().max(2500).optional(),
    relatedDate: z.string().max(10).optional(),
  }).safeParse({
    studentId: formData.get("studentId"),
    title: formData.get("title"),
    subjectId: String(formData.get("subjectId") || ""),
    contentType: formData.get("contentType"),
    description: String(formData.get("description") || ""),
    relatedDate: String(formData.get("relatedDate") || ""),
  });
  const meta = fileMetadata(formData);
  const fallbackStudentId = String(formData.get("studentId") || "");
  if (!parsed.success || !validFileMeta(meta)) {
    redirect(familyPath("/familia/conteudos", fallbackStudentId, "erro", "Revise os dados e anexe um PDF ou imagem de até 15 MB."));
  }

  const { viewer, guardian, selectedChild, supabase } = await getFamilyPortal(parsed.data.studentId);
  const prefix = `${viewer.user.id}/${parsed.data.studentId}/school/`;
  if (!guardian?.active || selectedChild?.student_id !== parsed.data.studentId || !meta.filePath.startsWith(prefix)) {
    if (meta.filePath.startsWith(`${viewer.user.id}/`)) await removeUpload(supabase, meta.filePath);
    redirect(familyPath("/familia/conteudos", parsed.data.studentId, "erro", "Criança ou arquivo não vinculado a esta família."));
  }

  const { error } = await supabase.from("family_school_uploads").insert({
    guardian_id: guardian.id,
    student_id: parsed.data.studentId,
    subject_id: parsed.data.subjectId || null,
    title: parsed.data.title,
    content_type: parsed.data.contentType,
    description: parsed.data.description || null,
    related_date: parsed.data.relatedDate || null,
    file_path: meta.filePath,
    file_name: meta.fileName,
    mime_type: meta.mimeType,
  });
  if (error) {
    await removeUpload(supabase, meta.filePath);
    redirect(familyPath("/familia/conteudos", parsed.data.studentId, "erro", "Não foi possível registrar o conteúdo."));
  }

  revalidatePath("/familia");
  revalidatePath("/familia/conteudos");
  revalidatePath("/professor/alunos");
  redirect(familyPath("/familia/conteudos", parsed.data.studentId, "sucesso", "Conteúdo enviado para o acompanhamento."));
}

export async function registerFamilyNotebookActivity(formData: FormData) {
  const parsed = z.object({
    assignmentId: z.string().uuid(),
    studentId: z.string().uuid(),
    note: z.string().trim().max(1500).optional(),
  }).safeParse({
    assignmentId: formData.get("assignmentId"),
    studentId: formData.get("studentId"),
    note: String(formData.get("note") || ""),
  });
  const meta = fileMetadata(formData);
  const fallbackStudentId = String(formData.get("studentId") || "");
  if (!parsed.success || !validFileMeta(meta)) {
    redirect(familyPath("/familia/atividades", fallbackStudentId, "erro", "Revise a atividade e anexe um PDF ou imagem de até 15 MB."));
  }

  const { viewer, selectedChild, supabase } = await getFamilyPortal(parsed.data.studentId);
  const prefix = `${viewer.user.id}/${parsed.data.studentId}/activity/`;
  if (selectedChild?.student_id !== parsed.data.studentId || !meta.filePath.startsWith(prefix)) {
    if (meta.filePath.startsWith(`${viewer.user.id}/`)) await removeUpload(supabase, meta.filePath);
    redirect(familyPath("/familia/atividades", parsed.data.studentId, "erro", "Criança ou arquivo não vinculado a esta família."));
  }

  const { data: assignment } = await supabase
    .from("notebook_assignments")
    .select("id,student_id,status,needs_redo")
    .eq("id", parsed.data.assignmentId)
    .eq("student_id", parsed.data.studentId)
    .maybeSingle();
  if (!assignment || (!assignment.needs_redo && !["assigned", "in_progress"].includes(String(assignment.status)))) {
    await removeUpload(supabase, meta.filePath);
    redirect(familyPath("/familia/atividades", parsed.data.studentId, "erro", "Esta atividade não está disponível para envio."));
  }

  const { error } = await supabase.rpc("submit_guardian_notebook_assignment", {
    p_assignment_id: parsed.data.assignmentId,
    p_file_path: meta.filePath,
    p_note: parsed.data.note || null,
  });
  if (error) {
    await removeUpload(supabase, meta.filePath);
    redirect(familyPath("/familia/atividades", parsed.data.studentId, "erro", "Não foi possível enviar esta atividade."));
  }

  revalidatePath("/familia/atividades");
  revalidatePath("/aluno/caderno");
  revalidatePath("/professor/correcoes");
  redirect(familyPath("/familia/atividades", parsed.data.studentId, "sucesso", "Atividade enviada para correção."));
}

export async function registerFamilyAssessment(formData: FormData) {
  const parsed = z.object({
    studentId: z.string().uuid(),
    subjectId: z.string().uuid().optional().or(z.literal("")),
    origin: z.enum(["guardian", "school"]),
    title: z.string().trim().min(2).max(180),
    assessmentDate: z.string().min(10).max(10),
    content: z.string().trim().max(2500).optional(),
    observations: z.string().trim().max(2500).optional(),
  }).safeParse({
    studentId: formData.get("studentId"),
    subjectId: String(formData.get("subjectId") || ""),
    origin: formData.get("origin"),
    title: formData.get("title"),
    assessmentDate: formData.get("assessmentDate"),
    content: String(formData.get("content") || ""),
    observations: String(formData.get("observations") || ""),
  });
  const meta = fileMetadata(formData);
  const hasFile = Boolean(meta.filePath || meta.fileName || meta.mimeType || meta.fileSize);
  const fallbackStudentId = String(formData.get("studentId") || "");
  if (!parsed.success || (hasFile && !validFileMeta(meta))) {
    redirect(familyPath("/familia/avaliacoes", fallbackStudentId, "erro", "Revise os dados da avaliação ou o anexo."));
  }

  const { viewer, guardian, selectedChild, supabase } = await getFamilyPortal(parsed.data.studentId);
  const prefix = `${viewer.user.id}/${parsed.data.studentId}/assessment/`;
  if (!guardian?.active || selectedChild?.student_id !== parsed.data.studentId || (hasFile && !meta.filePath.startsWith(prefix))) {
    if (meta.filePath.startsWith(`${viewer.user.id}/`)) await removeUpload(supabase, meta.filePath);
    redirect(familyPath("/familia/avaliacoes", parsed.data.studentId, "erro", "Criança ou arquivo não vinculado a esta família."));
  }

  const { error } = await supabase.from("family_assessment_reports").insert({
    guardian_id: guardian.id,
    student_id: parsed.data.studentId,
    subject_id: parsed.data.subjectId || null,
    origin: parsed.data.origin,
    title: parsed.data.title,
    assessment_date: parsed.data.assessmentDate,
    content: parsed.data.content || null,
    observations: parsed.data.observations || null,
    file_path: hasFile ? meta.filePath : null,
    file_name: hasFile ? meta.fileName : null,
    mime_type: hasFile ? meta.mimeType : null,
  });
  if (error) {
    if (hasFile) await removeUpload(supabase, meta.filePath);
    redirect(familyPath("/familia/avaliacoes", parsed.data.studentId, "erro", "Não foi possível salvar a avaliação."));
  }

  revalidatePath("/familia/avaliacoes");
  revalidatePath("/professor/alunos");
  redirect(familyPath("/familia/avaliacoes", parsed.data.studentId, "sucesso", "Avaliação informada para a equipe."));
}
