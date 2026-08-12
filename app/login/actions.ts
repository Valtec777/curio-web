"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const OFFICIAL_SITE_ORIGIN = "https://curio-web-nu.vercel.app";

const loginSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(6, "Informe sua senha."),
});

const emailSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
});

const strongPassword = z.string()
  .min(10, "A nova senha precisa ter pelo menos 10 caracteres.")
  .refine((value) => /[a-z]/.test(value), "Inclua pelo menos uma letra minúscula.")
  .refine((value) => /[A-Z]/.test(value), "Inclua pelo menos uma letra maiúscula.")
  .refine((value) => /\d/.test(value), "Inclua pelo menos um número.")
  .refine((value) => /[^A-Za-z0-9]/.test(value), "Inclua pelo menos um símbolo.");

const passwordSchema = z
  .object({
    password: strongPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

function queryError(message: string) {
  return `/login?erro=${encodeURIComponent(message)}`;
}

function normalizedOrigin(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return url.origin;
  } catch {
    return null;
  }
}

function isLocalOrigin(origin?: string | null) {
  return Boolean(origin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin));
}

function siteOrigin() {
  const configured = normalizedOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  const productionUrl = normalizedOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  const branchUrl = normalizedOrigin(process.env.VERCEL_BRANCH_URL);
  const deploymentUrl = normalizedOrigin(process.env.VERCEL_URL);
  const runningOnVercel = process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);

  if (productionUrl && !isLocalOrigin(productionUrl)) return productionUrl;
  if (configured && !isLocalOrigin(configured)) return configured;
  if (runningOnVercel) return OFFICIAL_SITE_ORIGIN;
  if (configured) return configured;
  if (branchUrl && !isLocalOrigin(branchUrl)) return branchUrl;
  if (deploymentUrl && !isLocalOrigin(deploymentUrl)) return deploymentUrl;
  return process.env.NODE_ENV === "development" ? "http://localhost:3000" : OFFICIAL_SITE_ORIGIN;
}

function portalFor(roles: string[]) {
  if (roles.includes("admin")) return "/admin";
  if (roles.includes("teacher")) return "/professor";
  if (roles.includes("guardian")) return "/familia";
  if (roles.includes("student")) return "/aluno";
  return "/dashboard";
}

function emailSendErrorMessage(code?: string) {
  if (code === "over_email_send_rate_limit") {
    return "Muitas tentativas de envio foram feitas em pouco tempo. Aguarde um instante e tente novamente.";
  }
  return "Não foi possível enviar o e-mail agora. Aguarde um pouco e tente novamente.";
}

export async function login(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) redirect(queryError(parsed.error.issues[0].message));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    redirect(queryError("Não foi possível entrar. Confira e-mail e senha."));
  }

  const { error: invitationSyncError } = await supabase.rpc("mark_access_invitation_accepted");
  if (invitationSyncError) {
    console.error("Falha ao sincronizar situação do convite após login", invitationSyncError.code);
  }

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);
  const roles = (roleRows ?? []).map((item: { role: string }) => item.role);
  const destination = portalFor(roles);

  await supabase.from("access_events").insert({ event_type: "login", route: destination });
  revalidatePath("/", "layout");
  redirect(destination);
}

async function sendFirstAccessLink(email: string) {
  const supabase = await createClient();
  const origin = siteOrigin();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/confirm?next=/definir-senha`,
    },
  });

  if (error) {
    console.error("Falha no envio do primeiro acesso", error.code);
    redirect(`/primeiro-acesso?erro=${encodeURIComponent(emailSendErrorMessage(error.code))}`);
  }
  redirect("/primeiro-acesso?sucesso=1");
}

async function sendPasswordLink(email: string, successPath: string) {
  const supabase = await createClient();
  const origin = siteOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/definir-senha`,
  });

  if (error) {
    console.error("Falha no envio do link de recuperação", error.code);
    redirect(`${successPath}?erro=${encodeURIComponent(emailSendErrorMessage(error.code))}`);
  }
  redirect(`${successPath}?sucesso=1`);
}

export async function requestFirstAccess(formData: FormData) {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    redirect(`/primeiro-acesso?erro=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }
  await sendFirstAccessLink(parsed.data.email);
}

export async function requestPasswordReset(formData: FormData) {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    redirect(`/esqueci-senha?erro=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }
  await sendPasswordLink(parsed.data.email, "/esqueci-senha");
}

export async function updatePassword(formData: FormData) {
  const parsed = passwordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    redirect(`/definir-senha?erro=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect(`/login?erro=${encodeURIComponent("O link expirou ou não é mais válido. Solicite um novo acesso.")}`);
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    redirect(`/definir-senha?erro=${encodeURIComponent("Não foi possível salvar a nova senha. Solicite um novo link e tente novamente.")}`);
  }

  await supabase.rpc("mark_access_invitation_accepted");
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(`/login?sucesso=${encodeURIComponent("Senha definida com sucesso. Agora você já pode entrar no Curió.")}`);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.from("access_events").insert({ event_type: "logout", route: "/" });
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete("curio_student_context");
  revalidatePath("/", "layout");
  redirect("/");
}
