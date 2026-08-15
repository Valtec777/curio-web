export type LegalProviderProfile = {
  brandName: string;
  legalName: string;
  taxId: string;
  address: string;
  email: string;
  phone: string;
  privacyContact: string;
};

export const defaultLegalProviderProfile: LegalProviderProfile = {
  brandName: "PLUMARELI",
  legalName: "Ellen Pedreira Neri",
  taxId: "",
  address: "",
  email: "curio.educacao@gmail.com",
  phone: "",
  privacyContact: "curio.educacao@gmail.com",
};

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function getLegalProviderProfile(supabase: any): Promise<LegalProviderProfile> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "legal_provider_profile").maybeSingle();
  const raw = data?.value && typeof data.value === "object" ? data.value : {};
  return {
    brandName: stringValue(raw.brandName) || defaultLegalProviderProfile.brandName,
    legalName: stringValue(raw.legalName) || defaultLegalProviderProfile.legalName,
    taxId: stringValue(raw.taxId),
    address: stringValue(raw.address),
    email: stringValue(raw.email) || defaultLegalProviderProfile.email,
    phone: stringValue(raw.phone),
    privacyContact: stringValue(raw.privacyContact) || stringValue(raw.email) || defaultLegalProviderProfile.privacyContact,
  };
}

export function providerTemplateVariables(profile: LegalProviderProfile): Record<string, string> {
  return {
    BRAND_NAME: profile.brandName,
    PROVIDER_LEGAL_NAME: profile.legalName || "[PREENCHER NOME DA PRESTADORA]",
    PROVIDER_TAX_ID: profile.taxId || "[PREENCHER CPF/CNPJ]",
    PROVIDER_ADDRESS: profile.address || "[PREENCHER ENDEREÇO PARA COMUNICAÇÕES]",
    PROVIDER_EMAIL: profile.email || "[PREENCHER E-MAIL]",
    PROVIDER_PHONE: profile.phone || "[PREENCHER TELEFONE/WHATSAPP]",
    PRIVACY_CONTACT: profile.privacyContact || profile.email || "[PREENCHER CANAL DE PRIVACIDADE]",
  };
}

export function providerProfileMissingFields(profile: LegalProviderProfile) {
  const missing: string[] = [];
  if (!profile.legalName) missing.push("nome civil/razão social");
  if (!profile.taxId) missing.push("CPF/CNPJ");
  if (!profile.address) missing.push("endereço para comunicações");
  if (!profile.email) missing.push("e-mail");
  if (!profile.phone) missing.push("telefone/WhatsApp");
  if (!profile.privacyContact) missing.push("canal de privacidade");
  return missing;
}

export function renderLegalTemplate(template: string, values: Record<string, string | number | null | undefined>) {
  return String(template || "").replace(/\{\{([A-Z0-9_]+)\}\}/g, (_match, key: string) => {
    const value = values[key];
    if (value === null || value === undefined || String(value).trim() === "") return `[${key}]`;
    return String(value);
  });
}

export function normalizeLegalName(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
}
