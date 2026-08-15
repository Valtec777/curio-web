"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentTeacher } from "@/lib/teacher";

const allowedMimeTypes = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

function safeFileName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 110);
}

function bahiaDateTime(value?: string | null, endOfDay = false) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T${endOfDay ? "23:59:59" : "00:00:00"}-03:00`).toISOString();
  const normalized = raw.length === 16 ? `${raw}:00` : raw;
  const date = new Date(`${normalized}-03:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function validateStudents(supabase: any, teacherId: string, rawIds: string[]) {
  const ids = [...new Set(rawIds.filter((value) => z.string().uuid().safeParse(value).success))];
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("teacher_students")
    .select("student_id")
    .eq("teacher_id", teacherId)
    .eq("active", true)
    .in("student_id", ids);
  if (error) throw new Error("student lookup failed");
  const allowed = new Set((data ?? []).map((item: any) => item.student_id));
  if (ids.some((id) => !allowed.has(id))) throw new Error("Aluno sem vínculo com este professor.");
  return ids;
}

function invalidResource(): never {
  redirect(`/professor/materiais?erro=${encodeURIComponent("Não foi possível identificar o material selecionado. Atualize a página e tente novamente.")}`);
}

async function rollbackCreatedResource({
  supabase,
  teacherId,
  kind,
  itemId,
  filePath,
}: {
  supabase: any;
  teacherId: string;
  kind: "material" | "notebook";
  itemId: string;
  filePath: string;
}) {
  const table = kind === "notebook" ? "notebook_activities" : "materials";
  await supabase.from(table).delete().eq("id", itemId).eq("created_by_teacher_id", teacherId);
  await supabase.storage.from("teacher-materials").remove([filePath]);
}

export async function createTeacherMaterial(formData: FormData) {
  const { teacher, supabase, viewer } = await getCurrentTeacher();
  if (!teacher) redirect("/professor/materiais?erro=Perfil+incompleto");

  const parsed = z.object({
    kind: z.enum(["material", "notebook"]),
    title: z.string().trim().min(2).max(180),
    description: z.string().trim().min(2).max(3000),
    subjectId: z.string().uuid().optional().or(z.literal("")),
    gradeId: z.string().uuid().optional().or(z.literal("")),
    category: z.enum(["pdf", "image", "file", "other"]).default("pdf"),
    publishMode: z.enum(["draft", "now", "later"]),
    publishAt: z.string().optional(),
    dueAt: z.string().optional(),
  }).safeParse({
    kind: formData.get("kind"),
    title: formData.get("title"),
    description: formData.get("description"),
    subjectId: String(formData.get("subjectId") || ""),
    gradeId: String(formData.get("gradeId") || ""),
    category: formData.get("category") || "pdf",
    publishMode: formData.get("publishMode") || "draft",
    publishAt: String(formData.get("publishAt") || ""),
    dueAt: String(formData.get("dueAt") || ""),
  });
  if (!parsed.success) redirect(`/professor/materiais?erro=${encodeURIComponent("Revise os dados do material.")}`);

  let studentIds: string[] = [];
  try {
    studentIds = await validateStudents(supabase, teacher.id, formData.getAll("studentIds").map(String));
  } catch {
    redirect(`/professor/materiais?erro=${encodeURIComponent("Um dos alunos selecionados não está mais vinculado a você.")}`);
  }

  const fileValue = formData.get("file");
  const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
  if (!file) redirect(`/professor/materiais?erro=${encodeURIComponent("Anexe o PDF ou a imagem do material.")}`);
  if (file.size > 15 * 1024 * 1024 || !allowedMimeTypes.has(file.type)) {
    redirect(`/professor/materiais?erro=${encodeURIComponent("Use PDF, PNG, JPG ou WEBP de até 15 MB.")}`);
  }

  const publishAt = parsed.data.publishMode === "later"
    ? bahiaDateTime(parsed.data.publishAt)
    : parsed.data.publishMode === "now"
      ? new Date().toISOString()
      : null;
  if (parsed.data.publishMode === "later" && !publishAt) {
    redirect(`/professor/materiais?erro=${encodeURIComponent("Escolha o dia e o horário da publicação.")}`);
  }
  if (publishAt && parsed.data.publishMode === "later" && new Date(publishAt) <= new Date()) {
    redirect(`/professor/materiais?erro=${encodeURIComponent("A publicação programada precisa estar no futuro.")}`);
  }
  const dueAt = bahiaDateTime(parsed.data.dueAt, true);

  const path = `${viewer.user.id}/${Date.now()}-${safeFileName(file.name || "material.pdf")}`;
  const { error: uploadError } = await supabase.storage.from("teacher-materials").upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) redirect(`/professor/materiais?erro=${encodeURIComponent("Não foi possível anexar o arquivo.")}`);

  const status = parsed.data.publishMode === "draft" ? "draft" : "published";
  let itemId: string | null = null;
  let insertError: any = null;

  if (parsed.data.kind === "notebook") {
    const result = await supabase.from("notebook_activities").insert({
      created_by_teacher_id: teacher.id,
      title: parsed.data.title,
      description: parsed.data.description,
      subject_id: parsed.data.subjectId || null,
      grade_id: parsed.data.gradeId || null,
      worksheet_path: path,
      status,
      publish_at: publishAt,
    }).select("id").single();
    itemId = result.data?.id || null;
    insertError = result.error;
  } else {
    const result = await supabase.from("materials").insert({
      created_by_teacher_id: teacher.id,
      title: parsed.data.title,
      description: parsed.data.description,
      subject_id: parsed.data.subjectId || null,
      grade_id: parsed.data.gradeId || null,
      material_type: parsed.data.category,
      file_path: path,
      status,
      publish_at: publishAt,
    }).select("id").single();
    itemId = result.data?.id || null;
    insertError = result.error;
  }

  if (insertError || !itemId) {
    await supabase.storage.from("teacher-materials").remove([path]);
    redirect(`/professor/materiais?erro=${encodeURIComponent("Não foi possível criar o material.")}`);
  }

  if (studentIds.length) {
    if (parsed.data.kind === "notebook") {
      const { error } = await supabase.from("notebook_assignments").upsert(
        studentIds.map((studentId) => ({ activity_id: itemId, student_id: studentId, assigned_by_teacher_id: teacher.id, due_at: dueAt, status: "assigned" })),
        { onConflict: "activity_id,student_id" },
      );
      if (error) {
        await rollbackCreatedResource({ supabase, teacherId: teacher.id, kind: parsed.data.kind, itemId, filePath: path });
        redirect(`/professor/materiais?erro=${encodeURIComponent("Não foi possível atribuir o Caderno Plumareli. O registro e o arquivo recém-criados foram revertidos para evitar conteúdo órfão.")}`);
      }
    } else {
      const { error } = await supabase.from("material_assignments").upsert(
        studentIds.map((studentId) => ({ material_id: itemId, student_id: studentId, assigned_by_teacher_id: teacher.id, due_at: dueAt, status: "assigned" })),
        { onConflict: "material_id,student_id" },
      );
      if (error) {
        await rollbackCreatedResource({ supabase, teacherId: teacher.id, kind: parsed.data.kind, itemId, filePath: path });
        redirect(`/professor/materiais?erro=${encodeURIComponent("Não foi possível atribuir o material. O registro e o arquivo recém-criados foram revertidos para evitar conteúdo órfão.")}`);
      }
    }
  }

  revalidatePath("/professor");
  revalidatePath("/professor/materiais");
  revalidatePath("/professor/conteudos");
  revalidatePath("/aluno");
  const label = parsed.data.kind === "notebook" ? "Caderno Plumareli" : "Material";
  const suffix = parsed.data.publishMode === "later" ? " programado" : parsed.data.publishMode === "now" ? " publicado" : " salvo como rascunho";
  redirect(`/professor/materiais?sucesso=${encodeURIComponent(`${label}${suffix}${studentIds.length ? ` para ${studentIds.length} aluno(s)` : ""}.`)}`);
}

export async function assignTeacherResource(formData: FormData) {
  const parsed = z.object({ kind: z.enum(["material", "notebook"]), id: z.string().uuid(), dueAt: z.string().optional() }).safeParse({
    kind: formData.get("kind"), id: formData.get("id"), dueAt: String(formData.get("dueAt") || ""),
  });
  if (!parsed.success) invalidResource();
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) redirect("/professor/materiais");

  const resourceTable = parsed.data.kind === "notebook" ? "notebook_activities" : "materials";
  const { data: resource, error: resourceError } = await supabase
    .from(resourceTable)
    .select("id")
    .eq("id", parsed.data.id)
    .eq("created_by_teacher_id", teacher.id)
    .maybeSingle();
  if (resourceError || !resource) redirect(`/professor/materiais?erro=${encodeURIComponent("Material não encontrado ou sem permissão para esta ação.")}`);

  let studentIds: string[] = [];
  try {
    studentIds = await validateStudents(supabase, teacher.id, formData.getAll("studentIds").map(String));
  } catch {
    redirect(`/professor/materiais?erro=${encodeURIComponent("Revise os alunos selecionados.")}`);
  }
  if (!studentIds.length) redirect(`/professor/materiais?erro=${encodeURIComponent("Escolha pelo menos um aluno.")}`);
  const dueAt = bahiaDateTime(parsed.data.dueAt, true);
  let preservedHistory = 0;

  if (parsed.data.kind === "notebook") {
    const { data: existingRows, error: existingError } = await supabase
      .from("notebook_assignments")
      .select("student_id,status,submitted_at,submission_photo_path,score,teacher_note,needs_redo")
      .eq("activity_id", parsed.data.id)
      .in("student_id", studentIds);
    if (existingError) redirect(`/professor/materiais?erro=${encodeURIComponent("Não foi possível verificar o histórico do Caderno Plumareli antes do envio.")}`);

    const existingByStudent = new Map((existingRows ?? []).map((row: any) => [row.student_id, row]));
    const payload = studentIds.flatMap((studentId) => {
      const current: any = existingByStudent.get(studentId);
      const hasHistory = Boolean(
        current
        && (
          current.submitted_at
          || current.submission_photo_path
          || current.score != null
          || current.teacher_note
          || current.needs_redo
          || ["submitted", "reviewed"].includes(current.status)
        )
      );
      if (hasHistory) {
        preservedHistory += 1;
        return [];
      }
      return [{
        activity_id: parsed.data.id,
        student_id: studentId,
        assigned_by_teacher_id: teacher.id,
        due_at: dueAt,
        status: current?.status === "in_progress" ? "in_progress" : "assigned",
      }];
    });

    if (payload.length) {
      const { error } = await supabase.from("notebook_assignments").upsert(payload, { onConflict: "activity_id,student_id" });
      if (error) redirect(`/professor/materiais?erro=${encodeURIComponent("Não foi possível enviar o Caderno Plumareli.")}`);
    }
  } else {
    const { data: existingRows, error: existingError } = await supabase
      .from("material_assignments")
      .select("student_id,status")
      .eq("material_id", parsed.data.id)
      .in("student_id", studentIds);
    if (existingError) redirect(`/professor/materiais?erro=${encodeURIComponent("Não foi possível verificar as atribuições atuais do material.")}`);

    const existingByStudent = new Map((existingRows ?? []).map((row: any) => [row.student_id, row.status]));
    const { error } = await supabase.from("material_assignments").upsert(
      studentIds.map((studentId) => {
        const currentStatus = existingByStudent.get(studentId);
        return {
          material_id: parsed.data.id,
          student_id: studentId,
          assigned_by_teacher_id: teacher.id,
          due_at: dueAt,
          status: currentStatus === "viewed" || currentStatus === "completed" ? currentStatus : "assigned",
        };
      }),
      { onConflict: "material_id,student_id" },
    );
    if (error) redirect(`/professor/materiais?erro=${encodeURIComponent("Não foi possível enviar o material para todos os alunos selecionados.")}`);
  }

  revalidatePath("/professor/materiais");
  revalidatePath("/aluno");
  const baseMessage = `Enviado para ${studentIds.length - preservedHistory} aluno(s).`;
  const historyMessage = preservedHistory
    ? ` ${preservedHistory} aluno(s) já tinham entrega/correção neste Caderno e foram preservados; duplique o Caderno para criar uma nova tentativa independente.`
    : "";
  redirect(`/professor/materiais?sucesso=${encodeURIComponent(`${baseMessage}${historyMessage}`)}`);
}

export async function duplicateTeacherResource(formData: FormData) {
  const parsed = z.object({ kind: z.enum(["material", "notebook"]), id: z.string().uuid() }).safeParse({ kind: formData.get("kind"), id: formData.get("id") });
  if (!parsed.success) invalidResource();
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) redirect("/professor/materiais");

  if (parsed.data.kind === "notebook") {
    const { data: item, error: readError } = await supabase.from("notebook_activities").select("title,description,subject_id,content_id,grade_id,worksheet_path").eq("id", parsed.data.id).eq("created_by_teacher_id", teacher.id).maybeSingle();
    if (readError || !item) redirect(`/professor/materiais?erro=${encodeURIComponent("Caderno não encontrado.")}`);
    const { error } = await supabase.from("notebook_activities").insert({ ...item, title: `${item.title} — cópia`, created_by_teacher_id: teacher.id, status: "draft", publish_at: null });
    if (error) redirect(`/professor/materiais?erro=${encodeURIComponent("Não foi possível duplicar o Caderno Plumareli.")}`);
  } else {
    const { data: item, error: readError } = await supabase.from("materials").select("title,description,subject_id,content_id,grade_id,material_type,file_path,external_url").eq("id", parsed.data.id).eq("created_by_teacher_id", teacher.id).maybeSingle();
    if (readError || !item) redirect(`/professor/materiais?erro=${encodeURIComponent("Material não encontrado.")}`);
    const { error } = await supabase.from("materials").insert({ ...item, title: `${item.title} — cópia`, created_by_teacher_id: teacher.id, status: "draft", publish_at: null });
    if (error) redirect(`/professor/materiais?erro=${encodeURIComponent("Não foi possível duplicar o material.")}`);
  }

  revalidatePath("/professor/materiais");
  revalidatePath("/professor/conteudos");
  redirect(`/professor/materiais?sucesso=${encodeURIComponent("Cópia criada como rascunho, sem alunos atribuídos.")}`);
}
