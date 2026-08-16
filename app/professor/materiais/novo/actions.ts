"use server";

import { getCurrentTeacher } from "@/lib/teacher";
import { createTeacherMaterial } from "../actions";

export async function createTeacherMaterialAssisted(formData: FormData) {
  const preparedPath = String(formData.get("preparedFilePath") || "").trim();
  const preparedName = String(formData.get("preparedFileName") || "material.pdf").trim() || "material.pdf";
  const preparedMimeType = String(formData.get("preparedFileMimeType") || "").trim();
  const preparedSize = Number(formData.get("preparedFileSize") || 0);
  const category = String(formData.get("category") || "pdf");
  const directValue = formData.get("file");
  const hasDirectFile = directValue instanceof File && directValue.size > 0;

  if (!preparedPath) return createTeacherMaterial(formData);

  const { supabase, viewer } = await getCurrentTeacher();
  if (!preparedPath.startsWith(`${viewer.user.id}/`) || preparedMimeType !== "application/pdf" || preparedSize > 15 * 1024 * 1024) {
    throw new Error("O PDF importado não é válido para esta conta.");
  }

  try {
    if (!hasDirectFile && category === "pdf") {
      const { data: source, error } = await supabase.storage.from("generation-sources").download(preparedPath);
      if (error || !source) throw new Error("O PDF importado não está mais disponível. Importe novamente.");
      const file = new File([await source.arrayBuffer()], preparedName, { type: "application/pdf" });
      formData.set("file", file);
    }
    return await createTeacherMaterial(formData);
  } finally {
    await supabase.storage.from("generation-sources").remove([preparedPath]);
  }
}
