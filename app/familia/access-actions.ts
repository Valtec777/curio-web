"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const pinSchema = z.string().regex(/^\d{4}$/, "Use exatamente 4 números.");
const studentIdSchema = z.string().uuid();

function studentCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 6,
  };
}

function familyReturn(value: string, key: "erro" | "sucesso", message: string) {
  const raw = value.startsWith("/familia") ? value : "/familia";
  const url = new URL(raw, "https://curio.local");
  url.searchParams.delete("erro");
  url.searchParams.delete("sucesso");
  url.searchParams.set(key, message);
  return `${url.pathname}${url.search}`;
}

export async function setFamilyPin(formData: FormData) {
  await requireRole("guardian");
  const requestedReturnTo = String(formData.get("returnTo") || "/familia");
  const parsed = pinSchema.safeParse(String(formData.get("pin") || ""));
  const confirmation = String(formData.get("pinConfirmation") || "");

  if (!parsed.success || parsed.data !== confirmation) {
    redirect(familyReturn(requestedReturnTo, "erro", "O PIN precisa ter 4 números iguais nos dois campos."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_guardian_portal_pin", { p_pin: parsed.data });
  if (error) {
    redirect(familyReturn(requestedReturnTo, "erro", "Não foi possível salvar o PIN agora. Tente novamente."));
  }

  redirect(familyReturn(requestedReturnTo, "sucesso", "PIN da família atualizado com segurança."));
}

export async function enterStudentSpace(formData: FormData) {
  const viewer = await requireRole("guardian");
  const parsed = studentIdSchema.safeParse(String(formData.get("studentId") || ""));
  if (!parsed.success) redirect("/familia");

  const supabase = await createClient();
  const { data: guardian } = await supabase
    .from("guardians")
    .select("id")
    .eq("profile_id", viewer.user.id)
    .maybeSingle();

  if (!guardian) redirect("/familia");

  const { data: pinStatus } = await supabase.rpc("guardian_pin_status");
  const firstPinStatus = Array.isArray(pinStatus) ? pinStatus[0] : null;
  if (!firstPinStatus?.has_pin) {
    redirect(`/familia?aluno=${parsed.data}&erro=${encodeURIComponent("Crie o PIN da família antes de abrir o espaço da criança.")}`);
  }

  const { data: link } = await supabase
    .from("guardian_students")
    .select("student_id")
    .eq("guardian_id", guardian.id)
    .eq("student_id", parsed.data)
    .maybeSingle();

  if (!link) redirect(`/familia?erro=${encodeURIComponent("Essa criança não está vinculada a esta conta.")}`);

  const cookieStore = await cookies();
  cookieStore.set("curio_student_context", parsed.data, studentCookieOptions());
  redirect("/aluno");
}

export async function unlockFamilyWithPin(formData: FormData) {
  await requireRole("guardian");
  const parsed = pinSchema.safeParse(String(formData.get("pin") || ""));
  if (!parsed.success) {
    redirect(`/aluno/desbloquear-familia?erro=${encodeURIComponent("Digite o PIN de 4 números.")}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verify_guardian_portal_pin", { p_pin: parsed.data });

  if (error || data !== true) {
    const { data: status } = await supabase.rpc("guardian_pin_status");
    const lockedUntil = Array.isArray(status) ? status[0]?.locked_until : null;
    const message = lockedUntil && new Date(lockedUntil) > new Date()
      ? "Muitas tentativas. Aguarde 5 minutos e tente novamente."
      : "PIN incorreto. Tente novamente.";
    redirect(`/aluno/desbloquear-familia?erro=${encodeURIComponent(message)}`);
  }

  const cookieStore = await cookies();
  cookieStore.delete("curio_student_context");
  redirect("/familia");
}
