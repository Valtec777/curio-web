"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentTeacher } from "@/lib/teacher";

function back(draftId: string, key: "erro" | "sucesso", message: string): never {
  redirect(`/professor/criar/revisao/${draftId}?${key}=${encodeURIComponent(message)}`);
}
function safeFileName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 110) || "fonte";
}
async function copySourceFile({ supabase, userId, draft }: { supabase: any; userId: string; draft: any }) {
  if (!draft.source_file_path) return null;
  const { data: blob, error: downloadError } = await supabase.storage.from("generation-sources").download(draft.source_file_path);
  if (downloadError || !blob) return { error: "Não foi possível ler o arquivo fonte para criar o rascunho final." } as const;
  const path = `${userId}/preparados/${draft.id}/${Date.now()}-${safeFileName(draft.source_file_name || "fonte")}`;
  const { error: uploadError } = await supabase.storage.from("teacher-materials").upload(path, blob, { contentType: draft.source_mime_type || blob.type || "application/octet-stream", upsert: false });
  if (uploadError) return { error: "Não foi possível copiar o arquivo fonte para o conteúdo final." } as const;
  return { path } as const;
}
function materialType(mime?: string | null) {
  if (mime === "application/pdf") return "pdf";
  if (String(mime || "").startsWith("image/")) return "image";
  return "file";
}

export async function convertPreparationDraft(formData: FormData) {
  const parsed = z.object({ draftId: z.string().uuid(), outputType: z.enum(["material", "activity", "assessment", "notebook_pdf"]) }).safeParse({ draftId: formData.get("draftId"), outputType: formData.get("outputType") });
  const draftId = String(formData.get("draftId") || "");
  if (!parsed.success) back(draftId, "erro", "Destino inválido.");

  const { teacher, supabase, viewer } = await getCurrentTeacher();
  if (!teacher) back(parsed.data.draftId, "erro", "Professor não identificado.");
  const { data: draft } = await supabase.from("content_preparation_drafts").select("id,title,source_text,source_file_path,source_file_name,source_mime_type,subject_id,grade_id,theme,objective,notes").eq("id", parsed.data.draftId).eq("created_by_teacher_id", teacher.id).maybeSingle();
  if (!draft) back(parsed.data.draftId, "erro", "Rascunho não encontrado.");

  const outputType = parsed.data.outputType;
  const { data: existing } = await supabase.from("content_preparation_outputs").select("output_id").eq("draft_id", draft.id).eq("output_type", outputType).maybeSingle();
  if (existing) back(draft.id, "sucesso", "Esse formato já foi criado a partir deste rascunho. Nenhuma cópia duplicada foi gerada.");

  const outputId = randomUUID();
  const { error: reserveError } = await supabase.from("content_preparation_outputs").insert({ draft_id: draft.id, output_type: outputType, output_id: outputId });
  if (reserveError) {
    if (reserveError.code === "23505") back(draft.id, "sucesso", "Esse formato já estava sendo criado. Nenhuma duplicata foi gerada.");
    back(draft.id, "erro", "Não foi possível reservar a criação do conteúdo.");
  }

  let filePath: string | null = null;
  if (draft.source_file_path) {
    const copied = await copySourceFile({ supabase, userId: viewer.user.id, draft });
    if (copied && "error" in copied) {
      await supabase.from("content_preparation_outputs").delete().eq("draft_id", draft.id).eq("output_type", outputType);
      back(draft.id, "erro", copied.error || "Não foi possível copiar o arquivo fonte.");
    }
    filePath = copied?.path || null;
  }

  const title = draft.title || draft.theme || "Conteúdo preparado";
  const description = [draft.objective, draft.notes, draft.source_text ? String(draft.source_text).slice(0, 12000) : null].filter(Boolean).join("\n\n") || "Conteúdo preparado para revisão.";
  let error: any = null;
  let destination = "/professor/conteudos";

  if (outputType === "material") {
    const result = await supabase.from("materials").insert({ id: outputId, created_by_teacher_id: teacher.id, title, description, subject_id: draft.subject_id, grade_id: draft.grade_id, material_type: materialType(draft.source_mime_type), file_path: filePath, status: "draft" });
    error = result.error;
    destination = "/professor/materiais";
  } else if (outputType === "activity" || outputType === "notebook_pdf") {
    const result = await supabase.from("notebook_activities").insert({ id: outputId, created_by_teacher_id: teacher.id, title: outputType === "activity" ? `${title} — atividade` : title, description, subject_id: draft.subject_id, grade_id: draft.grade_id, worksheet_path: filePath, status: "draft" });
    error = result.error;
    destination = "/professor/materiais";
  } else {
    const result = await supabase.from("assessments").insert({ id: outputId, created_by_teacher_id: teacher.id, title, instructions: description, subject_id: draft.subject_id, grade_id: draft.grade_id, file_path: filePath, status: "draft" });
    error = result.error;
    destination = "/professor/avaliacoes";
  }

  if (error) {
    if (filePath) await supabase.storage.from("teacher-materials").remove([filePath]);
    await supabase.from("content_preparation_outputs").delete().eq("draft_id", draft.id).eq("output_type", outputType);
    back(draft.id, "erro", "Não foi possível criar o rascunho no fluxo final.");
  }

  await supabase.from("content_preparation_drafts").update({ status: "converted", updated_at: new Date().toISOString() }).eq("id", draft.id);
  revalidatePath("/professor/criar");
  revalidatePath("/professor/gerador");
  revalidatePath("/professor/materiais");
  revalidatePath("/professor/avaliacoes");
  redirect(`${destination}?sucesso=${encodeURIComponent("Rascunho criado no fluxo final. Revise, escolha os alunos e publique somente quando estiver pronto.")}`);
}
