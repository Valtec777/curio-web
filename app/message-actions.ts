"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getCurrentTeacher } from "@/lib/teacher";
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
  subject: z.string().trim().min(2).max(160),
  body: z.string().trim().min(1).max(5000),
  actionLabel: z.string().trim().max(80).optional(),
  actionUrl: z.string().trim().max(500).optional(),
  contextKind: z.enum(["agenda", "mission"]).optional(),
  contextId: z.string().uuid().optional(),
  requestKey: z.string().trim().min(8).max(160),
}).superRefine((value, ctx) => {
  const hasLabel = Boolean(value.actionLabel);
  const hasUrl = Boolean(value.actionUrl);
  if (hasLabel !== hasUrl) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe texto e destino do botão juntos." });
  }
  if (Boolean(value.contextKind) !== Boolean(value.contextId)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Selecione um contexto válido para a mensagem." });
  }
});

type MessageVariables = Record<string, string | null>;

function formatBahiaDate(value?: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: "America/Bahia",
  }).format(new Date(value));
}

function formatBahiaTime(value?: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bahia",
  }).format(new Date(value));
}

function renderVariables(value: string, variables: MessageVariables) {
  const unknown = new Set<string>();
  const missing = new Set<string>();
  const rendered = value.replace(/\{\{\s*([a-z0-9_.]+)\s*\}\}/gi, (_match, rawName: string) => {
    const name = rawName.toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(variables, name)) {
      unknown.add(rawName);
      return `{{${rawName}}}`;
    }
    const resolved = variables[name];
    if (!resolved) {
      missing.add(rawName);
      return `{{${rawName}}}`;
    }
    return resolved;
  });
  return { rendered, unknown: [...unknown], missing: [...missing] };
}

function putAlias(variables: MessageVariables, underscoreName: string, dottedName: string, value: string | null) {
  variables[underscoreName] = value;
  variables[dottedName] = value;
}

export async function sendFamilyMessage(formData: FormData) {
  const { viewer, teacher, supabase } = await getCurrentTeacher();
  const returnPath = safeReturnPath(formData.get("returnPath") || "/professor/mensagens");
  if (!teacher) redirect(`${returnPath}?erro=${encodeURIComponent("Perfil de professor ainda não vinculado.")}`);

  const parsed = sendFamilyMessageSchema.safeParse({
    studentId: formData.get("studentId"),
    guardianId: formData.get("guardianId"),
    subject: formData.get("subject"),
    body: formData.get("body"),
    actionLabel: String(formData.get("actionLabel") || "").trim() || undefined,
    actionUrl: String(formData.get("actionUrl") || "").trim() || undefined,
    contextKind: String(formData.get("contextKind") || "").trim() || undefined,
    contextId: String(formData.get("contextId") || "").trim() || undefined,
    requestKey: formData.get("requestKey"),
  });

  if (!parsed.success) {
    redirect(`${returnPath}?erro=${encodeURIComponent(parsed.error.issues[0]?.message || "Revise a mensagem.")}`);
  }

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
    if (guardiansError) console.error("Falha ao validar família da mensagem", guardiansError.code);
    redirect(`${returnPath}?erro=${encodeURIComponent("Responsável ou aluno não está disponível para este professor.")}`);
  }

  const studentName = student.preferred_name || student.full_name || "aluno";
  const guardianName = guardian.guardian_name || "Responsável";
  const teacherName = viewer.profile?.preferred_name || viewer.profile?.full_name || "Professor PLUMARELI";
  const schoolName = student.school_name || "escola não informada";
  const gradeName = (student.grades as any)?.name || "ano escolar não informado";

  const variables: MessageVariables = {
    escola: schoolName,
    ano_escolar: gradeName,
    agenda_titulo: null,
    agenda_data: null,
    agenda_horario: null,
    agenda_link: null,
    "agenda.titulo": null,
    "agenda.data": null,
    "agenda.horario": null,
    "agenda.link": null,
    missao_nome: null,
    missao_prazo: null,
    "missao.nome": null,
    "missao.prazo": null,
  };
  putAlias(variables, "responsavel_nome", "responsavel.nome", guardianName);
  putAlias(variables, "aluno_nome", "aluno.nome", studentName);
  putAlias(variables, "professor_nome", "professor.nome", teacherName);

  if (parsed.data.contextKind === "agenda" && parsed.data.contextId) {
    const { data: event, error: eventError } = await supabase
      .from("agenda_events")
      .select("id,title,starts_at,meeting_url,agenda_event_students(student_id)")
      .eq("id", parsed.data.contextId)
      .eq("created_by_teacher_id", teacher.id)
      .maybeSingle();

    const linkedToStudent = (event?.agenda_event_students ?? []).some((item: any) => item.student_id === parsed.data.studentId);
    if (eventError || !event || !linkedToStudent) {
      if (eventError) console.error("Falha ao validar contexto de agenda da mensagem", eventError.code);
      redirect(`${returnPath}?erro=${encodeURIComponent("O encontro selecionado não pertence a este aluno/professor.")}`);
    }

    const eventDate = formatBahiaDate(event.starts_at);
    const eventTime = formatBahiaTime(event.starts_at);
    variables.agenda_titulo = event.title || "Encontro PLUMARELI";
    variables["agenda.titulo"] = variables.agenda_titulo;
    variables.agenda_data = eventDate;
    variables["agenda.data"] = eventDate;
    variables.agenda_horario = eventTime;
    variables["agenda.horario"] = eventTime;
    variables.agenda_link = event.meeting_url || null;
    variables["agenda.link"] = event.meeting_url || null;
  }

  if (parsed.data.contextKind === "mission" && parsed.data.contextId) {
    const { data: assignment, error: assignmentError } = await supabase
      .from("mission_students")
      .select("id,student_id,due_at,missions(id,title)")
      .eq("id", parsed.data.contextId)
      .eq("student_id", parsed.data.studentId)
      .eq("assigned_by_teacher_id", teacher.id)
      .maybeSingle();

    if (assignmentError || !assignment) {
      if (assignmentError) console.error("Falha ao validar contexto de missão da mensagem", assignmentError.code);
      redirect(`${returnPath}?erro=${encodeURIComponent("A missão selecionada não pertence a este aluno/professor.")}`);
    }

    const mission = assignment.missions as any;
    const dueDate = assignment.due_at ? formatBahiaDate(assignment.due_at) : "sem prazo definido";
    variables.missao_nome = mission?.title || "Missão Cuca";
    variables["missao.nome"] = variables.missao_nome;
    variables.missao_prazo = dueDate;
    variables["missao.prazo"] = dueDate;
  }

  const subject = renderVariables(parsed.data.subject, variables);
  const body = renderVariables(parsed.data.body, variables);
  const actionLabel = parsed.data.actionLabel ? renderVariables(parsed.data.actionLabel, variables) : null;
  const actionUrl = parsed.data.actionUrl ? renderVariables(parsed.data.actionUrl, variables) : null;
  const unknownVariables = [...subject.unknown, ...body.unknown, ...(actionLabel?.unknown ?? []), ...(actionUrl?.unknown ?? [])];
  const missingVariables = [...subject.missing, ...body.missing, ...(actionLabel?.missing ?? []), ...(actionUrl?.missing ?? [])];

  if (unknownVariables.length) {
    redirect(`${returnPath}?erro=${encodeURIComponent(`Variável não reconhecida: {{${unknownVariables[0]}}}.`)}`);
  }
  if (missingVariables.length) {
    redirect(`${returnPath}?erro=${encodeURIComponent(`A variável {{${missingVariables[0]}}} precisa de um encontro ou missão com esse dado preenchido.`)}`);
  }

  if (subject.rendered.length > 160 || body.rendered.length > 5000 || (actionLabel && actionLabel.rendered.length > 80) || (actionUrl && actionUrl.rendered.length > 500)) {
    redirect(`${returnPath}?erro=${encodeURIComponent("A mensagem ficou maior que o limite depois de preencher as variáveis.")}`);
  }
  if (actionUrl && !actionUrl.rendered.startsWith("/") && !actionUrl.rendered.startsWith("https://")) {
    redirect(`${returnPath}?erro=${encodeURIComponent("O destino do botão precisa resultar em uma rota do PLUMARELI ou URL HTTPS.")}`);
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
    console.error("Falha ao enviar mensagem para família", error.code);
    redirect(`${returnPath}?erro=${encodeURIComponent("Não foi possível enviar a mensagem agora. Nenhuma mensagem duplicada deve ser criada; tente novamente.")}`);
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
