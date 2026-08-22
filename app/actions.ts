"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const PUBLIC_GRADES = [
  "1º ano",
  "2º ano",
  "3º ano",
  "4º ano",
  "5º ano",
  "6º ano",
  "7º ano",
  "8º ano",
  "9º ano",
  "1º ano do Ensino Médio",
  "2º ano do Ensino Médio",
  "3º ano do Ensino Médio",
] as const;

const controlCharacters = /[\u0000-\u001f\u007f]/;
const phoneCharacters = /^[0-9+().\-\s]+$/;

const leadSchema = z.object({
  guardian_name: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .refine((value) => !controlCharacters.test(value)),
  phone_whatsapp: z
    .string()
    .trim()
    .min(8)
    .max(40)
    .regex(phoneCharacters)
    .refine((value) => {
      const digits = value.replace(/\D/g, "");
      return digits.length >= 8 && digits.length <= 15;
    }),
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  grade_name: z.enum(PUBLIC_GRADES),
  referral_code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{6,24}$/)
    .transform((value) => value.toUpperCase())
    .optional(),
  consent_contact: z.literal("on"),
});

function requestFingerprint(payload: Record<string, unknown>) {
  return `public-lead-v3:${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
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
  const { data: grade, error: gradeError } = await supabase
    .from("grades")
    .select("id")
    .eq("name", parsed.data.grade_name)
    .maybeSingle();

  if (gradeError || !grade?.id) {
    console.error("Falha ao validar ano escolar do interesse público", gradeError?.code || "grade_not_found");
    redirect(leadDestination(referralCode, "erro"));
  }

  const phoneDigits = parsed.data.phone_whatsapp.replace(/\D/g, "");
  const requestDay = new Date().toISOString().slice(0, 10);
  const idempotencyKey = requestFingerprint({
    guardian_name: parsed.data.guardian_name.toLowerCase(),
    phone_whatsapp: phoneDigits,
    email: parsed.data.email,
    grade_id: grade.id,
    request_day: requestDay,
  });

  const { error } = await supabase.from("enrollment_requests").insert({
    guardian_name: parsed.data.guardian_name,
    phone_whatsapp: parsed.data.phone_whatsapp,
    email: parsed.data.email,
    child_name: null,
    child_age: null,
    grade_id: grade.id,
    subjects: [],
    main_difficulties: null,
    message: null,
    consent_contact: true,
    status: "new",
    idempotency_key: idempotencyKey,
    request_day: requestDay,
    referral_code: parsed.data.referral_code ?? referralCode,
    deleted_at: null,
  });

  if (error && error.code !== "23505") {
    console.error("Falha ao registrar interesse no PLUMARELI", error.code);
    redirect(leadDestination(referralCode, "erro"));
  }

  redirect(leadDestination(referralCode, "sucesso"));
}
