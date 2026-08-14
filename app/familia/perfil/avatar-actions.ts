"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getFamilyPortal } from "@/lib/family";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

function back(studentId: string | null, key: "erro" | "sucesso", message: string) {
  const params = new URLSearchParams();
  if (studentId) params.set("aluno", studentId);
  params.set(key, message);
  return `/familia/perfil?${params.toString()}`;
}

export async function registerFamilyAvatar(formData: FormData) {
  const parsed = z.object({
    studentId: z.string().uuid().optional().or(z.literal("")),
    uploadedFilePath: z.string().trim().min(1).max(500),
    uploadedMimeType: z.string().trim().min(1).max(180),
    uploadedFileSize: z.coerce.number().int().positive().max(MAX_BYTES),
  }).safeParse({
    studentId: String(formData.get("studentId") || ""),
    uploadedFilePath: formData.get("uploadedFilePath"),
    uploadedMimeType: formData.get("uploadedMimeType"),
    uploadedFileSize: formData.get("uploadedFileSize"),
  });
  if (!parsed.success) redirect(back(null, "erro", "Foto inválida. Use PNG, JPG ou WEBP de até 5 MB."));

  const studentId = parsed.data.studentId || null;
  const { viewer, supabase } = await getFamilyPortal(studentId);
  const path = parsed.data.uploadedFilePath;
  const validPath = path.startsWith(`${viewer.user.id}/familia-`);
  if (!validPath || !ALLOWED.has(parsed.data.uploadedMimeType)) {
    if (path.startsWith(`${viewer.user.id}/`)) await supabase.storage.from("profile-avatars").remove([path]);
    redirect(back(studentId, "erro", "A foto enviada não é válida."));
  }

  const { data: oldProfile } = await supabase.from("profiles").select("avatar_path").eq("id", viewer.user.id).maybeSingle();
  const { error } = await supabase.from("profiles").update({ avatar_path: path, updated_at: new Date().toISOString() }).eq("id", viewer.user.id);
  if (error) {
    await supabase.storage.from("profile-avatars").remove([path]);
    redirect(back(studentId, "erro", "Não foi possível salvar a foto."));
  }
  if (oldProfile?.avatar_path?.startsWith(`${viewer.user.id}/`) && oldProfile.avatar_path !== path) {
    await supabase.storage.from("profile-avatars").remove([oldProfile.avatar_path]);
  }

  revalidatePath("/familia");
  revalidatePath("/familia/perfil");
  redirect(back(studentId, "sucesso", "Foto atualizada."));
}
