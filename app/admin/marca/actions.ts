"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import {
  BRAND_ASSET_BUCKET,
  BRAND_ASSET_MAX_BYTES,
  BRAND_ASSET_MIME_TYPES,
  BRAND_ASSET_PREFIX,
  BRAND_SETTING_KEY,
} from "@/lib/brand-assets";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_MIME_TYPES = new Set<string>(BRAND_ASSET_MIME_TYPES);

const uploadedLogoSchema = z.object({
  uploadedFilePath: z.string().trim().min(3).max(500),
  uploadedMimeType: z.string().trim().min(3).max(100),
  uploadedFileSize: z.coerce.number().int().positive().max(BRAND_ASSET_MAX_BYTES),
});

function storagePathFromPublicUrl(value?: string | null) {
  if (!value) return null;
  const marker = `/storage/v1/object/public/${BRAND_ASSET_BUCKET}/`;
  const markerIndex = value.indexOf(marker);
  if (markerIndex < 0) return null;
  const encodedPath = value.slice(markerIndex + marker.length).split("?")[0];
  try {
    return decodeURIComponent(encodedPath);
  } catch {
    return encodedPath;
  }
}

async function revalidateBrand() {
  for (const path of ["/", "/login", "/dashboard", "/admin/marca", "/api/brand/logo"]) {
    revalidatePath(path);
  }
}

export async function registerBrandLogo(formData: FormData) {
  const viewer = await requireRole("admin");
  const parsed = uploadedLogoSchema.safeParse({
    uploadedFilePath: formData.get("uploadedFilePath"),
    uploadedMimeType: formData.get("uploadedMimeType"),
    uploadedFileSize: formData.get("uploadedFileSize"),
  });

  if (!parsed.success || !ALLOWED_MIME_TYPES.has(parsed.data?.uploadedMimeType || "")) {
    return { ok: false as const, message: "Imagem inválida. Use PNG, JPG ou WEBP de até 5 MB." };
  }

  if (!parsed.data.uploadedFilePath.startsWith(`${BRAND_ASSET_PREFIX}/`)) {
    return { ok: false as const, message: "O caminho enviado não pertence à área de marca." };
  }

  const supabase = await createClient();
  const pathParts = parsed.data.uploadedFilePath.split("/");
  const filename = pathParts.pop() || "";
  const folder = pathParts.join("/");
  const { data: storedFiles, error: storageError } = await supabase.storage
    .from(BRAND_ASSET_BUCKET)
    .list(folder, { search: filename, limit: 5 });

  if (storageError || !storedFiles?.some((item) => item.name === filename)) {
    return { ok: false as const, message: "A logo não foi localizada no armazenamento." };
  }

  const { data: publicData } = supabase.storage
    .from(BRAND_ASSET_BUCKET)
    .getPublicUrl(parsed.data.uploadedFilePath);
  const publicUrl = publicData.publicUrl;

  const { data: currentSetting } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", BRAND_SETTING_KEY)
    .maybeSingle();

  const previousValue = (currentSetting?.value || {}) as Record<string, unknown>;
  const previousLogo = typeof previousValue.logo === "string" ? previousValue.logo : null;
  const nextValue = {
    ...previousValue,
    logo: publicUrl,
    logoUpdatedAt: new Date().toISOString(),
  };

  const { error: settingError } = await supabase.from("app_settings").upsert({
    key: BRAND_SETTING_KEY,
    value: nextValue,
    is_public: true,
    updated_by_user_id: viewer.user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: "key" });

  if (settingError) {
    return { ok: false as const, message: "A imagem foi enviada, mas não foi possível ativar a nova logo." };
  }

  await supabase.from("media_assets").insert({
    name: "Logo PLUMARELI — principal",
    category: "brand",
    external_url: publicUrl,
    mime_type: parsed.data.uploadedMimeType,
    alt_text: "Plumareli",
    source_entity_type: "brand",
    created_by_user_id: viewer.user.id,
    active: true,
  });

  const previousPath = storagePathFromPublicUrl(previousLogo);
  if (previousPath && previousPath !== parsed.data.uploadedFilePath && previousPath.startsWith(`${BRAND_ASSET_PREFIX}/`)) {
    await supabase.storage.from(BRAND_ASSET_BUCKET).remove([previousPath]);
  }

  await revalidateBrand();
  return { ok: true as const, message: "Logo atualizada. A nova versão já é a logo central do Plumareli." };
}

export async function restoreDefaultBrandLogo() {
  const viewer = await requireRole("admin");
  const supabase = await createClient();
  const { data: currentSetting } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", BRAND_SETTING_KEY)
    .maybeSingle();

  const currentValue = (currentSetting?.value || {}) as Record<string, unknown>;
  const currentLogo = typeof currentValue.logo === "string" ? currentValue.logo : null;
  const nextValue = { ...currentValue };
  delete nextValue.logo;
  nextValue.logoUpdatedAt = new Date().toISOString();

  const { error } = await supabase.from("app_settings").upsert({
    key: BRAND_SETTING_KEY,
    value: nextValue,
    is_public: true,
    updated_by_user_id: viewer.user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: "key" });

  if (error) return { ok: false as const, message: "Não foi possível restaurar a logo original." };

  const currentPath = storagePathFromPublicUrl(currentLogo);
  if (currentPath && currentPath.startsWith(`${BRAND_ASSET_PREFIX}/`)) {
    await supabase.storage.from(BRAND_ASSET_BUCKET).remove([currentPath]);
  }

  await revalidateBrand();
  return { ok: true as const, message: "Logo original restaurada." };
}
