"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const leadSchema = z.object({
  guardian_name: z.string().trim().min(2).max(120),
  phone_whatsapp: z.string().trim().min(8).max(40),
  email: z.string().trim().email().max(320),
  grade_name: z.string().trim().min(1).max(80),
  referral_code: z.string().trim().regex(/^[A-Za-z0-9]{6,24}$/).optional(),
  consent_contact: z.literal("on"),
});

function requestFingerprint(payload: Record<string, unknown>) {
  return `public-lead-v2:${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

function leadDestination(referralCode: string | null, kind: "sucesso" | "erro") {
  if (referralCode) return `/convite/${encodeURIComponent(referralCode)}?lead=${kind}#quero-conhecer`;
  return `/?lead=${kind}#quero-conhecer`;
}

export async function createEnrollmentRequest(formData: FormData) {
  const parsed = leadSchema.safeParse({
    guardian_name: formData.get("guardian_name"),
    phone_whatsapp: formData.get("phone_whatsapp"),
    email: formData.get("email"),
    grade_name: formData.get("grade_name"),
    referral_code: formData.get("referral_code") || undefined,
    consent_contact: formData.get("consent_contact"),
  });

  const rawReferralCode = String(formData.get("referral_code") || "").trim().toUpperCase();
  const referralCode = /^[A-Z0-9]{6,24}$/.test(rawReferralCode) ? rawReferralCode : null;

  if (!parsed.success) {
    redirect(leadDestination(referralCode, "erro"));
  }

  const supabase = await createClient();
  const { data: grade } = await supabase
    .from("grades")
    .select("id")
    .eq("name", parsed.data.grade_name)
    .maybeSingle();

  const requestDay = new Date().toISOString().slice(0, 10);
  const idempotencyKey = requestFingerprint({
    guardian_name: parsed.data.guardian_name.toLowerCase(),
    phone_whatsapp: parsed.data.phone_whatsapp.replace(/\D/g, ""),
    email: parsed.data.email.toLowerCase(),
    grade_id: grade?.id ?? null,
    request_day: requestDay,
  });

  const { error } = await supabase.from("enrollment_requests").insert({
    guardian_name: parsed.data.guardian_name,
    phone_whatsapp: parsed.data.phone_whatsapp,
    email: parsed.data.email.toLowerCase(),
    child_name: null,
    child_age: null,
    grade_id: grade?.id ?? null,
    subjects: [],
    main_difficulties: null,
    message: null,
    consent_contact: true,
    status: "new",
    idempotency_key: idempotencyKey,
    request_day: requestDay,
    referral_code: referralCode,
    deleted_at: null,
  });

  if (error && error.code !== "23505") {
    console.error("Falha ao registrar interesse no PLUMARELI", error.code);
    redirect(leadDestination(referralCode, "erro"));
  }

  redirect(leadDestination(referralCode, "sucesso"));
}
