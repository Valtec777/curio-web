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
  const { data: message } = await supabase
    .from("messages")
    .select("id,thread_id,sender_user_id,body,deleted_at,edited_at")
    .eq("id", messageId)
    .maybeSingle();
  if (!message || message.deleted_at) return;

  const isAdmin = viewer.roles.includes("admin");
  const canRemove = isAdmin || (viewer.roles.includes("teacher") && message.sender_user_id === viewer.user.id);
  if (!canRemove) redirect(`${returnPath}?erro=${encodeURIComponent("Você só pode remover mensagens permitidas para o seu papel.")}`);

  const now = new Date();
  if (isAdmin) {
    const reason = String(formData.get("reason") || "").trim() || "Removida pelo Admin";
    const { error: trashError } = await supabase.from("trash_items").insert({
      entity_type: "messages",
      entity_id: message.id,
      entity_snapshot: {
        label: "Mensagem",
        thread_id: message.thread_id,
        sender_user_id: message.sender_user_id,
        body_preview: message.body.slice(0, 180),
        previous_edited_at: message.edited_at,
        reason,
      },
      deleted_by_user_id: viewer.user.id,
      deleted_at: now.toISOString(),
      restore_until: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (trashError && trashError.code !== "23505") {
      redirect(`${returnPath}?erro=${encodeURIComponent("Não foi possível enviar a mensagem para a Lixeira.")}`);
    }
  }

  const { error } = await supabase.from("messages").update({
    deleted_at: now.toISOString(),
    edited_at: now.toISOString(),
  }).eq("id", message.id).is("deleted_at", null);
  if (error) redirect(`${returnPath}?erro=${encodeURIComponent(error.message)}`);

  revalidatePath(returnPath);
  if (isAdmin) revalidatePath("/admin/lixeira");
  redirect(`${returnPath}?sucesso=${encodeURIComponent(isAdmin ? "Mensagem enviada para a Lixeira." : "Mensagem removida da conversa.")}`);
}
