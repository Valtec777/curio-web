"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import {
  CHARACTER_ASSET_BUCKET,
  CHARACTER_ASSET_MAX_BYTES,
  CHARACTER_ASSET_MIME_TYPES,
} from "@/lib/character-assets";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_MIME_TYPES = new Set<string>(CHARACTER_ASSET_MIME_TYPES);
const assetKeys = ["principal", "avatar", "sticker", "activity", "thinking"] as const;

const uploadedMascotSchema = z.object({
  characterId: z.string().uuid(),
  uploadedFilePath: z.string().trim().min(3).max(500),
  uploadedMimeType: z.string().trim().min(3).max(100),
  uploadedFileSize: z.coerce.number().int().positive().max(CHARACTER_ASSET_MAX_BYTES),
});

function storagePathFromPublicUrl(value?: string | null) {
  if (!value) return null;
  const marker = `/storage/v1/object/public/${CHARACTER_ASSET_BUCKET}/`;
  const markerIndex = value.indexOf(marker);
  if (markerIndex < 0) return null;
  const encodedPath = value.slice(markerIndex + marker.length).split("?")[0];
  try {
    return decodeURIComponent(encodedPath);
  } catch {
    return encodedPath;
  }
}

export async function registerMascotImage(formData: FormData) {
  const viewer = await requireRole("admin");
  const parsed = uploadedMascotSchema.safeParse({
    characterId: formData.get("characterId"),
    uploadedFilePath: formData.get("uploadedFilePath"),
    uploadedMimeType: formData.get("uploadedMimeType"),
    uploadedFileSize: formData.get("uploadedFileSize"),
  });

  if (!parsed.success || !ALLOWED_MIME_TYPES.has(parsed.data?.uploadedMimeType || "")) {
    return { ok: false as const, message: "Imagem inválida. Use PNG, JPG ou WEBP de até 5 MB." };
  }

  const supabase = await createClient();
  const { data: character, error: characterError } = await supabase
    .from("characters")
    .select("id,slug,name,assets")
    .eq("id", parsed.data.characterId)
    .maybeSingle();

  if (characterError || !character) {
    return { ok: false as const, message: "Mascote não encontrado." };
  }

  const expectedPrefix = `${character.slug}/`;
  if (!parsed.data.uploadedFilePath.startsWith(expectedPrefix)) {
    return { ok: false as const, message: "O caminho da imagem não corresponde ao mascote selecionado." };
  }

  const pathParts = parsed.data.uploadedFilePath.split("/");
  const filename = pathParts.pop() || "";
  const folder = pathParts.join("/");
  const { data: storedFiles, error: storageError } = await supabase.storage
    .from(CHARACTER_ASSET_BUCKET)
    .list(folder, { search: filename, limit: 5 });

  if (storageError || !storedFiles?.some((item) => item.name === filename)) {
    return { ok: false as const, message: "A imagem não foi localizada no armazenamento." };
  }

  const { data: publicData } = supabase.storage
    .from(CHARACTER_ASSET_BUCKET)
    .getPublicUrl(parsed.data.uploadedFilePath);
  const publicUrl = publicData.publicUrl;

  const previousAssets: Record<string, string> = { ...(character.assets || {}) };
  const previousGenericUrls = new Set(
    [previousAssets.principal, previousAssets.avatar].filter(Boolean),
  );
  const nextAssets: Record<string, string> = { ...previousAssets };

  // A imagem enviada vira a fonte canônica do mascote. Campos que já usavam a
  // mesma imagem genérica também acompanham a troca, sem destruir poses
  // específicas que tenham sido configuradas separadamente.
  for (const key of assetKeys) {
    if (key === "principal" || key === "avatar" || previousGenericUrls.has(previousAssets[key])) {
      nextAssets[key] = publicUrl;
    }
  }

  const { error: updateError } = await supabase
    .from("characters")
    .update({ assets: nextAssets, updated_at: new Date().toISOString() })
    .eq("id", character.id);

  if (updateError) {
    return { ok: false as const, message: "A imagem foi enviada, mas não foi possível atualizar o mascote." };
  }

  // Registra a versão na biblioteca como histórico operacional. A atualização
  // do personagem já foi concluída, então uma falha aqui não desfaz a troca.
  await supabase.from("media_assets").insert({
    name: `${character.name} — imagem principal`,
    category: "mascot",
    external_url: publicUrl,
    mime_type: parsed.data.uploadedMimeType,
    alt_text: character.name,
    source_entity_type: "character",
    source_entity_id: character.id,
    created_by_user_id: viewer.user.id,
    active: true,
  });

  const previousStoragePaths = new Set(
    [previousAssets.principal, previousAssets.avatar]
      .map(storagePathFromPublicUrl)
      .filter((value): value is string => Boolean(value)),
  );
  previousStoragePaths.delete(parsed.data.uploadedFilePath);
  if (previousStoragePaths.size) {
    await supabase.storage.from(CHARACTER_ASSET_BUCKET).remove([...previousStoragePaths]);
  }

  for (const path of [
    "/admin/mascotes",
    "/admin/personagens",
    "/aluno",
    "/aluno/perfil",
    "/aluno/caminho",
    "/professor/missoes/nova",
    "/admin/cursos",
  ]) {
    revalidatePath(path);
  }

  return { ok: true as const, message: `${character.name} atualizado em todos os usos centralizados.` };
}
