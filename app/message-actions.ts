"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function safeReturnPath(value: FormDataEntryValue | null) {
  const path = String(value || "/dashboard");
  return path.startsWith("/admin/") || path.startsWith("/professor/") ? path : "/dashboard";
}

const messageEditSchema = z.object({
  messageId: z.string().uuid(),
  body: z.string().min(1).max(5000),
});

export async function editTeamMessage(formData: FormData) {
  const viewer = await requireUser();
  const returnPath = safeReturnPath(formData.get("returnPath"));
  if (!viewer.roles.includes("admin") && !viewer.roles.includes("teacher")) redirect(returnPath);
  const parsed = messageEditSchema.safeParse({ messageId: formData.get("messageId"), body: formData.get("body") });
  if (!parsed.success) redirect(`${returnPath}?erro=${encodeURIComponent("Revise a mensagem.")}`);
  const supabase = await createClient();
  const { data: message } = await supabase.from("messages").select("id,sender_user_id,deleted_at").eq("id", parsed.data.messageId).maybeSingle();
  if (!message || message.deleted_at) redirect(`${returnPath}?erro=${encodeURIComponent("Mensagem não encontrada.")}`);
  const canEdit = viewer.roles.includes("admin") || (viewer.roles.includes("teacher") && message.sender_user_id === viewer.user.id);
  if (!canEdit) redirect(`${returnPath}?erro=${encodeURIComponent("Você só pode editar mensagens permitidas para o seu papel.")}`);
  const { error } = await supabase.from("messages").update({ body: parsed.data.body.trim(), edited_at: new Date().toISOString() }).eq("id", message.id);
  if (error) redirect(`${returnPath}?erro=${encodeURIComponent(error.message)}`);
  revalidatePath(returnPath);
  redirect(`${returnPath}?sucesso=${encodeURIComponent("Mensagem editada.")}`);
}

export async function removeTeamMessage(formData: FormData) {
  const viewer = await requireUser();
  const returnPath = safeReturnPath(formData.get("returnPath"));
  if (!viewer.roles.includes("admin") && !viewer.roles.includes("teacher")) redirect(returnPath);
  const messageId = String(formData.get("messageId") || "");
  if (!z.string().uuid().safeParse(messageId).success) return;
  const supabase = await createClient();
  const { data: message } = await supabase.from("messages").select("id,sender_user_id,deleted_at").eq("id", messageId).maybeSingle();
  if (!message || message.deleted_at) return;
  const canRemove = viewer.roles.includes("admin") || (viewer.roles.includes("teacher") && message.sender_user_id === viewer.user.id);
  if (!canRemove) redirect(`${returnPath}?erro=${encodeURIComponent("Você só pode remover mensagens permitidas para o seu papel.")}`);
  const { error } = await supabase.from("messages").update({ deleted_at: new Date().toISOString(), edited_at: new Date().toISOString() }).eq("id", message.id);
  if (error) redirect(`${returnPath}?erro=${encodeURIComponent(error.message)}`);
  revalidatePath(returnPath);
  redirect(`${returnPath}?sucesso=${encodeURIComponent("Mensagem removida da conversa.")}`);
}
