"use server";

import { getCurrentTeacher } from "@/lib/teacher";
import { createTeacherAssessment } from "../actions";

export async function createTeacherAssessmentAssisted(formData: FormData) {
  const preparedPath = String(formData.get("preparedFilePath") || "").trim();
  const preparedName = String(formData.get("preparedFileName") || "avaliacao.pdf").trim() || "avaliacao.pdf";
  const preparedMimeType = String(formData.get("preparedFileMimeType") || "").trim();
  const preparedSize = Number(formData.get("preparedFileSize") || 0);
  const reusePreparedFile = formData.get("reusePreparedFile") === "on";
  const directValue = formData.get("file");
  const hasDirectFile = directValue instanceof File && directValue.size > 0;

  const content = String(formData.get("content") || "").trim();
  const observation = String(formData.get("observation") || "").trim();
  const instructions = [content ? `CONTEÚDO\n${content}` : "", observation ? `OBSERVAÇÃO\n${observation}` : ""].filter(Boolean).join("\n\n");
  formData.set("instructions", instructions);

  if (!preparedPath) return createTeacherAssessment(formData);

  const { supabase, viewer } = await getCurrentTeacher();
  if (!preparedPath.startsWith(`${viewer.user.id}/`) || preparedMimeType !== "application/pdf" || preparedSize > 15 * 1024 * 1024) {
    throw new Error("O PDF importado não é válido para esta conta.");
  }

  try {
    if (!hasDirectFile && reusePreparedFile) {
      const { data: source, error } = await supabase.storage.from("generation-sources").download(preparedPath);
      if (error || !source) throw new Error("O PDF importado não está mais disponível. Importe novamente.");
      const file = new File([await source.arrayBuffer()], preparedName, { type: "application/pdf" });
      formData.set("file", file);
    }
    return await createTeacherAssessment(formData);
  } finally {
    await supabase.storage.from("generation-sources").remove([preparedPath]);
  }
}
