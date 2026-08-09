"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const leadSchema = z.object({
  guardian_name: z.string().trim().min(2),
  phone_whatsapp: z.string().trim().min(8),
  email: z.string().trim().email(),
  child_name: z.string().trim().optional(),
  child_age: z.coerce.number().int().min(5).max(18).optional(),
  grade_name: z.string().trim().min(1),
  main_difficulties: z.string().trim().optional(),
  message: z.string().trim().optional(),
  consent_contact: z.literal("on"),
});

export async function createEnrollmentRequest(formData: FormData) {
  const parsed = leadSchema.safeParse({
    guardian_name: formData.get("guardian_name"),
    phone_whatsapp: formData.get("phone_whatsapp"),
    email: formData.get("email"),
    child_name: formData.get("child_name") || undefined,
    child_age: formData.get("child_age") || undefined,
    grade_name: formData.get("grade_name"),
    main_difficulties: formData.get("main_difficulties") || undefined,
    message: formData.get("message") || undefined,
    consent_contact: formData.get("consent_contact"),
  });

  if (!parsed.success) {
    redirect("/?lead=erro#quero-conhecer");
  }

  const supabase = await createClient();
  const { data: grade } = await supabase
    .from("grades")
    .select("id")
    .eq("name", parsed.data.grade_name)
    .maybeSingle();

  const subjects = formData
    .getAll("subjects")
    .map((value) => String(value))
    .filter(Boolean);

  const { error } = await supabase.from("enrollment_requests").insert({
    guardian_name: parsed.data.guardian_name,
    phone_whatsapp: parsed.data.phone_whatsapp,
    email: parsed.data.email,
    child_name: parsed.data.child_name || null,
    child_age: parsed.data.child_age ?? null,
    grade_id: grade?.id ?? null,
    subjects,
    main_difficulties: parsed.data.main_difficulties || null,
    message: parsed.data.message || null,
    consent_contact: true,
    status: "new",
  });

  if (error) {
    console.error("Falha ao registrar interesse no CURIÓ", error.code);
    redirect("/?lead=erro#quero-conhecer");
  }

  redirect("/?lead=sucesso#quero-conhecer");
}
