export const BRAND_SETTING_KEY = "brand_assets";

// Reutiliza o bucket público de imagens administradas, que já possui limite de
// 5 MB, MIME restrito e escrita protegida por papel Admin.
export const BRAND_ASSET_BUCKET = "character-assets";
export const BRAND_ASSET_PREFIX = "brand/logo";
export const BRAND_ASSET_MAX_BYTES = 5 * 1024 * 1024;
export const BRAND_ASSET_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export const BRAND_LOGO_FALLBACK = "/brand/plumareli-logo-oficial.webp?v=20260817-1";
export const BRAND_LOGO_ENDPOINT = "/api/brand/logo";

// Símbolo reduzido oficial (P + personagem), materializado no prebuild a partir
// dos ativos versionados em .brand-assets. Ele é usado quando a interface não
// tem largura suficiente para a assinatura principal permanecer legível.
export const BRAND_SYMBOL_FALLBACK = "/brand/plumareli-symbol.webp";
