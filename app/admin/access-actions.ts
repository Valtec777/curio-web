"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { getSiteOrigin } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

function safeAdminReturn(value: string) {
  return value.startsWith("/admin") ? value : "/admin/usuarios";
}

async function invokeAccessControl(body: Record<string, unknown>) {
  await requireRole("admin");
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("curio-access-control", { body });
  if (error || data?.error) {
    return { ok: false as const, message: data?.error || error?.message || "Não foi possível atualizar o acesso." };
  }
  return { ok: true as const, data };
}

const contactSchema = z.object({
  profileId: z.string().uuid(),
  returnTo: z.string().optional(),
  fullName: z.string().trim().min(2).max(160),
  preferredName: z.string().trim().max(120).optional(),
  email: z.union([z.string().trim().email("Informe um e-mail válido."), z.literal("")]),
  phone: z.string().trim().max(50).optional(),
});

export async function updateAdminAccessContact(formData: FormData) {
  const parsed = contactSchema.safeParse({
    profileId: formData.get("profileId"),
    returnTo: String(formData.get("returnTo") || "/admin/usuarios"),
    fullName: formData.get("fullName"),
    preferredName: String(formData.get("preferredName") || ""),
    email: String(formData.get("email") || ""),
    phone: String(formData.get("phone") || ""),
  });
  const returnTo = safeAdminReturn(String(formData.get("returnTo") || "/admin/usuarios"));
  if (!parsed.success) {
    redirect(`${returnTo}?erro=${encodeURIComponent(parsed.error.issues[0]?.message || "Revise os dados de acesso.")}`);
  }

  const result = await invokeAccessControl({
    action: "update_contact",
    auth_user_id: parsed.data.profileId,
    full_name: parsed.data.fullName,
    preferred_name: parsed.data.preferredName || null,
    email: parsed.data.email || null,
    phone_whatsapp: parsed.data.phone || null,
  });

  if (!result.ok) {
    redirect(`${returnTo}?erro=${encodeURIComponent(result.message)}`);
  }

  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/familias");
  revalidatePath("/admin/professores");
  revalidatePath("/admin/matriculas");
  redirect(`${returnTo}?sucesso=${encodeURIComponent("Dados de acesso atualizados. O mesmo usuário e os vínculos foram preservados.")}`);
}

const sendSchema = z.object({
  profileId: z.string().uuid(),
  returnTo: z.string().optional(),
});

export async function sendAdminAccessLink(formData: FormData) {
  const parsed = sendSchema.safeParse({
    profileId: formData.get("profileId"),
    returnTo: String(formData.get("returnTo") || "/admin/usuarios"),
  });
  const returnTo = safeAdminReturn(String(formData.get("returnTo") || "/admin/usuarios"));
  if (!parsed.success) {
    redirect(`${returnTo}?erro=${encodeURIComponent("Usuário de acesso inválido.")}`);
  }

  const result = await invokeAccessControl({
    action: "send_access_link",
    auth_user_id: parsed.data.profileId,
    origin: getSiteOrigin(),
  });

  if (!result.ok) {
    redirect(`${returnTo}?erro=${encodeURIComponent(result.message)}`);
  }

  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/familias");
  revalidatePath("/admin/professores");
  revalidatePath("/admin/matriculas");
  redirect(`${returnTo}?sucesso=${encodeURIComponent("Novo link de acesso enviado para o e-mail atual do usuário.")}`);
}
