"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function safeReturnPath(value: FormDataEntryValue | null) {
  const path = String(value || "/dashboard");
  return path.startsWith("/admin/") || path.startsWith("/professor/") ? path : "/dashboard";
}

const messageEditSchema = z.object({
  messageId: z.string().uuid(),
  body: z.string().min(1).max(5000),
});

const sendFamilyMessageSchema = z.object({
  studentId: z.string().uuid(),
  guardianId: z.string().uuid(),
  subject: z.string().trim().min(2).max(300),
  body: z.string().trim().min(1).max(5000),
  actionLabel: z.string().trim().max(80).optional(),
  actionUrl: z.string().trim().max(500).optional(),
  requestKey: z.string().trim().min(8).max(160),
}).superRefine((value, ctx) => {
  const hasLabel = Boolean(value.actionLabel);
  const hasUrl = Boolean(value.actionUrl);
  if (hasLabel !== hasUrl) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe texto e destino do botão juntos." });
  }
  if (value.actionUrl && !value.actionUrl.startsWith("/") && !value.actionUrl.startsWith("https://")) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "O destino do botão precisa ser uma rota do CURIÓ ou URL HTTPS." });
  }
});

type MessageVariables = Record<"responsavel_nome" | "aluno_nome" | "professor_nome" | "escola" | "ano_escolar", string>;

function renderVariables(value: string, variables: MessageVariables) {
  const unknown = new Set<string>();
  const rendered = value.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_match, rawName: string) => {
    const name = rawName.toLowerCase() as keyof MessageVariables;
    if (name in variables) return variables[name];
    unknown.add(rawName);
    return `{{${rawName}}}`;
  });
  return { rendered, unknown: [...unknown] };
}

export async function sendFamilyMessage(formData: FormData) {
  const viewer = await requireRole("teacher");
  const returnPath = safeReturnPath(formData.get("returnPath") || "/professor/mensagens");
  const parsed = sendFamilyMessageSchema.safeParse({
    studentId: formData.get("studentId"),
    guardianId: formData.get("guardianId"),
    subject: formData.get("subject"),
    body: formData.get("body"),
    actionLabel: String(formData.get("actionLabel") || "").trim() || undefined,
    actionUrl: String(formData.get("actionUrl") || "").trim() || undefined,
    requestKey: formData.get("requestKey"),
  });

  if (!parsed.success) {
    redirect(`${returnPath}?erro=${encodeURIComponent(parsed.error.issues[0]?.message || "Revise a mensagem.")}`);
  }

  const supabase = await createClient();
  const [{ data: student }, { data: guardianRows, error: guardiansError }] = await Promise.all([
    supabase
      .from("students")
      .select("id,preferred_name,full_name,school_name,grades(name)")
      .eq("id", parsed.data.studentId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase.rpc("teacher_linked_guardian_names"),
  ]);

  const guardian = (guardianRows ?? []).find((item: any) => item.student_id === parsed.data.studentId && item.guardian_id === parsed.data.guardianId);
  if (guardiansError || !student || !guardian) {
    redirect(`${returnPath}?erro=${encodeURIComponent("Responsável ou aluno não está disponível para este professor.")}`);
  }

  const variables: MessageVariables = {
    responsavel_nome: guardian.guardian_name || "Responsável",
    aluno_nome: student.preferred_name || student.full_name || "aluno",
    professor_nome: viewer.profile?.preferred_name || viewer.profile?.full_name || "Professor CURIÓ",
    escola: student.school_name || "escola não informada",
    ano_escolar: (student.grades as any)?.name || "ano escolar não informado",
  };

  const subject = renderVariables(parsed.data.subject, variables);
  const body = renderVariables(parsed.data.body, variables);
  const actionLabel = parsed.data.actionLabel ? renderVariables(parsed.data.actionLabel, variables) : null;
  const actionUrl = parsed.data.actionUrl ? renderVariables(parsed.data.actionUrl, variables) : null;
  const unknownVariables = [...subject.unknown, ...body.unknown, ...(actionLabel?.unknown ?? []), ...(actionUrl?.unknown ?? [])];

  if (unknownVariables.length) {
    redirect(`${returnPath}?erro=${encodeURIComponent(`Variável não reconhecida: {{${unknownVariables[0]}}}.`)}`);
  }

  const { error } = await supabase.rpc("send_curio_family_message", {
    p_student_id: parsed.data.studentId,
    p_guardian_id: parsed.data.guardianId,
    p_subject: subject.rendered,
    p_body: body.rendered,
    p_action_label: actionLabel?.rendered || null,
    p_action_url: actionUrl?.rendered || null,
    p_request_key: parsed.data.requestKey,
  });

  if (error) {
    redirect(`${returnPath}?erro=${encodeURIComponent(error.message || "Não foi possível enviar a mensagem.")}`);
  }

  revalidatePath("/professor/mensagens");
  revalidatePath("/familia/mensagens");
  revalidatePath("/familia");
  redirect(`${returnPath}?sucesso=${encodeURIComponent("Mensagem enviada para a família.")}`);
}

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
