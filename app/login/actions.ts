"use server";

import { cookies } from "next/headers";
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

function siteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      console.error("NEXT_PUBLIC_SITE_URL inválida; usando fallback seguro.");
    }
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  return "http://localhost:3000";
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
  const origin = siteOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/definir-senha`,
  });

  // Não revelamos se o e-mail existe ou não.
  if (error) {
    console.error("Falha no envio do link de acesso/recuperação", error.code);
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
