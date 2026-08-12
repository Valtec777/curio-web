"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const referralLeadSchema = z.object({
  referral_code: z.string().trim().min(6).max(40),
  guardian_name: z.string().trim().min(2).max(120),
  phone_whatsapp: z.string().trim().min(8).max(40),
  email: z.string().trim().email().max(200),
  child_name: z.string().trim().max(120).optional(),
  child_age: z.coerce.number().int().min(5).max(18).optional(),
  grade_name: z.string().trim().min(1).max(60),
  main_difficulties: z.string().trim().max(1200).optional(),
  consent_contact: z.literal("on"),
});

function referralReturn(code: string, state: "sucesso" | "erro"): never {
  redirect(`/indicacao/${encodeURIComponent(code)}?lead=${state}`);
}

export async function createReferralEnrollmentRequest(formData: FormData) {
  const parsed = referralLeadSchema.safeParse({
    referral_code: formData.get("referral_code"),
    guardian_name: formData.get("guardian_name"),
    phone_whatsapp: formData.get("phone_whatsapp"),
    email: formData.get("email"),
    child_name: formData.get("child_name") || undefined,
    child_age: formData.get("child_age") || undefined,
    grade_name: formData.get("grade_name"),
    main_difficulties: formData.get("main_difficulties") || undefined,
    consent_contact: formData.get("consent_contact"),
  });

  if (!parsed.success) return referralReturn(String(formData.get("referral_code") || "invalido"), "erro");

  const data = parsed.data;
  const normalizedCode = data.referral_code.toUpperCase();
  const supabase = await createClient();

  // Usa a RPC pública existente: ela valida código ativo e programa ativo sem expor
  // guardian_id/teacher_id na Data API.
  const { data: landing, error: landingError } = await supabase.rpc("referral_landing", {
    p_code: normalizedCode,
  });
  const landingRow = Array.isArray(landing) ? landing[0] : landing;
  if (landingError || !landingRow?.program_active) return referralReturn(normalizedCode, "erro");

  const { data: grade } = await supabase
    .from("grades")
    .select("id")
    .eq("name", data.grade_name)
    .eq("active", true)
    .maybeSingle();

  const { error: enrollmentError } = await supabase.from("enrollment_requests").insert({
    guardian_name: data.guardian_name,
    phone_whatsapp: data.phone_whatsapp,
    email: data.email.toLowerCase(),
    child_name: data.child_name || null,
    child_age: data.child_age ?? null,
    grade_id: grade?.id ?? null,
    subjects: [],
    main_difficulties: data.main_difficulties || null,
    message: "Interesse recebido por link de indicação.",
    consent_contact: true,
    status: "new",
    referral_code: normalizedCode,
  });

  if (enrollmentError) {
    console.error("Falha ao registrar interesse indicado", enrollmentError.code);
    return referralReturn(normalizedCode, "erro");
  }

  // O trigger trg_capture_referral_lead cria public.referrals e, quando o código é de
  // professor, liga a solicitação ao professor sem o formulário precisar de acesso
  // privilegiado às tabelas internas do programa.
  return referralReturn(normalizedCode, "sucesso");
}
