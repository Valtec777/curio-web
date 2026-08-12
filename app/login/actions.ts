"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(6, "Informe sua senha."),
});

const emailSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
});

const passwordSchema = z
  .object({
    password: z.string().min(8, "A nova senha precisa ter pelo menos 8 caracteres."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

function queryError(message: string) {
  return `/login?erro=${encodeURIComponent(message)}`;
}

function normalizePublicOrigin(value: string | null | undefined) {
  if (!value) return null;
  const raw = value.trim().replace(/\/$/, "");
  if (!raw) return null;

  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (process.env.NODE_ENV === "production" && local) return null;
    if (!local && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

async function siteOrigin() {
  // Em produção, prefira sempre a URL estável do projeto na Vercel. Isso evita
  // gerar e-mails de acesso apontando para localhost ou para um preview efêmero.
  const vercelProduction = normalizePublicOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (process.env.NODE_ENV === "production" && vercelProduction) return vercelProduction;

  const configured = normalizePublicOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (configured) return configured;

  const requestHeaders = await headers();
  const origin = normalizePublicOrigin(requestHeaders.get("origin"));
  if (origin) return origin;

  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
  const forwarded = normalizePublicOrigin(host ? `${protocol}://${host}` : null);
  if (forwarded) return forwarded;

  return process.env.NODE_ENV === "production" ? "https://curio-web-nu.vercel.app" : "http://localhost:3000";
}

function portalFor(roles: string[]) {
  if (roles.includes("admin")) return "/admin";
  if (roles.includes("teacher")) return "/professor";
  if (roles.includes("guardian")) return "/familia";
  if (roles.includes("student")) return "/aluno";
  return "/dashboard";
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

async function sendPasswordLink(email: string, successPath: string) {
  const supabase = await createClient();
  const origin = await siteOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // Mantemos toda recuperação/primeiro acesso no mesmo callback. Ele sabe
    // tratar PKCE, token_hash e também o fluxo legado com sessão no fragmento.
    redirectTo: `${origin}/auth/confirm?next=/definir-senha`,
  });

  // Não revelamos se o e-mail existe ou não.
  if (error) {
    redirect(`${successPath}?erro=${encodeURIComponent("Não foi possível enviar o e-mail agora. Aguarde um pouco e tente novamente.")}`);
  }
  redirect(`${successPath}?sucesso=1`);
}

export async function requestFirstAccess(formData: FormData) {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    redirect(`/primeiro-acesso?erro=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }
  await sendPasswordLink(parsed.data.email, "/primeiro-acesso");
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
