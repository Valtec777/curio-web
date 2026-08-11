"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentTeacher } from "@/lib/teacher";

const agendaSchema = z.object({
  idempotencyKey: z.string().min(8).max(160),
  studentId: z.string().uuid(),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1200).optional(),
  eventType: z.enum(["meeting", "family_meeting", "review", "assessment", "deadline", "reminder", "class", "other"]),
  status: z.enum(["scheduled", "confirmed", "completed", "cancelled"]),
  startsAt: z.string().min(10),
  endsAt: z.string().optional(),
  meetingUrl: z.string().trim().max(1200).optional(),
  location: z.string().trim().max(300).optional(),
});

function bahiaDateTime(value?: string) {
  if (!value?.trim()) return null;
  const normalized = value.length === 16 ? `${value}:00` : value;
  const date = new Date(`${normalized}-03:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function agendaDateLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bahia",
  }).format(new Date(value));
}

function eventKindLabel(eventType?: string | null) {
  if (eventType === "class") return "aula";
  if (eventType === "family_meeting" || eventType === "meeting") return "reunião";
  if (eventType === "assessment") return "avaliação";
  if (eventType === "review") return "revisão";
  return "encontro";
}

async function linkedGuardiansForStudent(supabase: any, studentId: string) {
  const { data, error } = await supabase.rpc("teacher_linked_guardian_names");
  if (error) {
    console.error("Falha ao localizar responsáveis vinculados para aviso de agenda", error.code);
    return [] as any[];
  }
  return (data ?? []).filter((row: any) => row.student_id === studentId && row.guardian_id);
}

async function sendAgendaFamilyNotice({
  supabase,
  studentId,
  studentName,
  title,
  eventType,
  startsAt,
  eventId,
  status,
}: {
  supabase: any;
  studentId: string;
  studentName: string;
  title: string;
  eventType: string;
  startsAt: string;
  eventId: string;
  status: "scheduled" | "confirmed" | "completed" | "cancelled";
}) {
  const guardians = await linkedGuardiansForStudent(supabase, studentId);
  if (!guardians.length) return { attempted: 0, failed: 0 };

  const when = agendaDateLabel(startsAt);
  const kind = eventKindLabel(eventType);
  let failed = 0;

  for (const guardian of guardians) {
    const statusText = status === "cancelled"
      ? `foi cancelad${kind === "reunião" || kind === "aula" || kind === "avaliação" || kind === "revisão" ? "a" : "o"}`
      : status === "confirmed"
        ? `foi confirmad${kind === "reunião" || kind === "aula" || kind === "avaliação" || kind === "revisão" ? "a" : "o"}`
        : "foi agendado";
    const subject = status === "scheduled"
      ? `${kind.charAt(0).toUpperCase()}${kind.slice(1)} de ${studentName} em ${when}`
      : `Atualização no encontro de ${studentName}`;
    const body = status === "scheduled"
      ? `Olá, ${guardian.guardian_name || "responsável"}! ${studentName} tem ${kind} marcada para ${when}: “${title}”. Os detalhes e o acesso ficam na Agenda da Família.`
      : `Olá, ${guardian.guardian_name || "responsável"}! O encontro “${title}” de ${studentName}, previsto para ${when}, ${statusText}. Confira a Agenda da Família para a situação atual.`;

    const { error } = await supabase.rpc("send_curio_family_message", {
      p_student_id: studentId,
      p_guardian_id: guardian.guardian_id,
      p_subject: subject,
      p_body: body,
      p_action_label: "Ver agenda",
      p_action_url: "/familia/agenda",
      p_request_key: `agenda:${eventId}:${status}:${guardian.guardian_id}`,
    });
    if (error) {
      failed += 1;
      console.error("Falha ao enviar aviso interno de agenda", error.code);
    }
  }

  return { attempted: guardians.length, failed };
}

export async function createAgendaEvent(formData: FormData) {
  const parsed = agendaSchema.safeParse({
    idempotencyKey: formData.get("idempotencyKey"),
    studentId: formData.get("studentId"),
    title: formData.get("title"),
    description: String(formData.get("description") || ""),
    eventType: formData.get("eventType"),
    status: formData.get("status") || "scheduled",
    startsAt: formData.get("startsAt"),
    endsAt: String(formData.get("endsAt") || ""),
    meetingUrl: String(formData.get("meetingUrl") || ""),
    location: String(formData.get("location") || ""),
  });

  if (!parsed.success) {
    redirect(`/professor/agenda?erro=${encodeURIComponent("Confira os dados do encontro.")}`);
  }

  const startsAt = bahiaDateTime(parsed.data.startsAt);
  const endsAt = bahiaDateTime(parsed.data.endsAt);
  if (!startsAt) redirect(`/professor/agenda?erro=${encodeURIComponent("Informe uma data e horário válidos.")}`);
  if (endsAt && new Date(endsAt) <= new Date(startsAt)) {
    redirect(`/professor/agenda?erro=${encodeURIComponent("O término precisa ser depois do início.")}`);
  }

  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) redirect(`/professor/agenda?erro=${encodeURIComponent("Seu perfil de professor ainda não está vinculado.")}`);

  const { data: linkedStudent } = await supabase
    .from("teacher_students")
    .select("student_id,students(preferred_name,full_name)")
    .eq("teacher_id", teacher.id)
    .eq("student_id", parsed.data.studentId)
    .eq("active", true)
    .maybeSingle();
  if (!linkedStudent) {
    redirect(`/professor/agenda?erro=${encodeURIComponent("Este aluno não está vinculado a você.")}`);
  }

  const visibleToGuardian = formData.get("visibleToGuardian") === "on";
  const { data: eventId, error } = await supabase.rpc("create_teacher_agenda_event", {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_student_id: parsed.data.studentId,
    p_title: parsed.data.title,
    p_description: parsed.data.description || "",
    p_event_type: parsed.data.eventType,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
    p_meeting_url: parsed.data.meetingUrl || "",
    p_location: parsed.data.location || "",
    p_visible_to_student: formData.get("visibleToStudent") === "on",
    p_visible_to_guardian: visibleToGuardian,
  });

  if (error || !eventId) {
    console.error("Falha ao criar evento da agenda", error?.code);
    redirect(`/professor/agenda?erro=${encodeURIComponent("Não foi possível criar o encontro. Verifique o vínculo do aluno e tente novamente.")}`);
  }

  if (parsed.data.status !== "scheduled") {
    const { error: statusError } = await supabase
      .from("agenda_events")
      .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
      .eq("id", eventId)
      .eq("created_by_teacher_id", teacher.id);
    if (statusError) redirect(`/professor/agenda?erro=${encodeURIComponent("O encontro foi criado, mas o status precisa ser atualizado novamente.")}`);
  }

  let noticeFailed = 0;
  if (visibleToGuardian && parsed.data.status !== "completed") {
    const studentRelation: any = (linkedStudent as any).students;
    const student = Array.isArray(studentRelation) ? studentRelation[0] : studentRelation;
    const studentName = student?.preferred_name || student?.full_name || "Aluno";
    const notice = await sendAgendaFamilyNotice({
      supabase,
      studentId: parsed.data.studentId,
      studentName,
      title: parsed.data.title,
      eventType: parsed.data.eventType,
      startsAt,
      eventId: String(eventId),
      status: parsed.data.status,
    });
    noticeFailed = notice.failed;
  }

  revalidatePath("/professor/agenda");
  revalidatePath("/professor");
  revalidatePath("/professor/alunos");
  revalidatePath("/aluno/agenda");
  revalidatePath("/aluno");
  revalidatePath("/familia/agenda");
  revalidatePath("/familia/mensagens");
  revalidatePath("/familia");

  const success = noticeFailed
    ? "Encontro salvo. Um aviso interno da família não pôde ser enviado; o encontro continua disponível na Agenda."
    : visibleToGuardian
      ? "Encontro salvo e aviso interno enviado para a família vinculada."
      : "Encontro salvo e disponibilizado para os participantes selecionados.";
  redirect(`/professor/agenda?sucesso=${encodeURIComponent(success)}`);
}

export async function setAgendaEventStatus(formData: FormData) {
  const parsed = z.object({
    eventId: z.string().uuid(),
    status: z.enum(["scheduled", "confirmed", "completed", "cancelled"]),
  }).safeParse({
    eventId: formData.get("eventId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;

  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) return;

  const { data: event } = await supabase
    .from("agenda_events")
    .select("id,title,event_type,starts_at,visible_to_guardian")
    .eq("id", parsed.data.eventId)
    .eq("created_by_teacher_id", teacher.id)
    .maybeSingle();
  if (!event) redirect(`/professor/agenda?erro=${encodeURIComponent("Encontro não encontrado.")}`);

  const { error } = await supabase
    .from("agenda_events")
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.eventId)
    .eq("created_by_teacher_id", teacher.id);

  if (error) redirect(`/professor/agenda?erro=${encodeURIComponent("Não foi possível atualizar o encontro.")}`);

  let noticeFailed = 0;
  if (event.visible_to_guardian && ["confirmed", "cancelled"].includes(parsed.data.status)) {
    const { data: assignments } = await supabase
      .from("agenda_event_students")
      .select("student_id,students(preferred_name,full_name)")
      .eq("event_id", parsed.data.eventId);

    for (const assignment of assignments ?? []) {
      const studentRelation: any = (assignment as any).students;
      const student = Array.isArray(studentRelation) ? studentRelation[0] : studentRelation;
      const studentName = student?.preferred_name || student?.full_name || "Aluno";
      const notice = await sendAgendaFamilyNotice({
        supabase,
        studentId: assignment.student_id,
        studentName,
        title: event.title,
        eventType: event.event_type,
        startsAt: event.starts_at,
        eventId: event.id,
        status: parsed.data.status,
      });
      noticeFailed += notice.failed;
    }
  }

  revalidatePath("/professor/agenda");
  revalidatePath("/professor");
  revalidatePath("/professor/alunos");
  revalidatePath("/aluno/agenda");
  revalidatePath("/familia/agenda");
  revalidatePath("/familia/mensagens");

  const message = noticeFailed
    ? "Situação atualizada. Um aviso interno não pôde ser entregue; a Agenda já mostra a informação correta."
    : parsed.data.status === "cancelled"
      ? "Encontro cancelado e família vinculada avisada no portal."
      : parsed.data.status === "confirmed"
        ? "Encontro confirmado e família vinculada avisada no portal."
        : "Situação do encontro atualizada.";
  redirect(`/professor/agenda?sucesso=${encodeURIComponent(message)}`);
}
