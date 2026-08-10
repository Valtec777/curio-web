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
  eventType: z.enum(["meeting", "assessment", "deadline", "reminder", "class", "other"]),
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

export async function createAgendaEvent(formData: FormData) {
  const parsed = agendaSchema.safeParse({
    idempotencyKey: formData.get("idempotencyKey"),
    studentId: formData.get("studentId"),
    title: formData.get("title"),
    description: String(formData.get("description") || ""),
    eventType: formData.get("eventType"),
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
    .select("student_id")
    .eq("teacher_id", teacher.id)
    .eq("student_id", parsed.data.studentId)
    .eq("active", true)
    .maybeSingle();
  if (!linkedStudent) {
    redirect(`/professor/agenda?erro=${encodeURIComponent("Este aluno não está vinculado a você.")}`);
  }

  const { error } = await supabase.rpc("create_teacher_agenda_event", {
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
    p_visible_to_guardian: formData.get("visibleToGuardian") === "on",
  });

  if (error) {
    console.error("Falha ao criar evento da agenda", error.code);
    redirect(`/professor/agenda?erro=${encodeURIComponent("Não foi possível criar o encontro. Verifique o vínculo do aluno e tente novamente.")}`);
  }

  revalidatePath("/professor/agenda");
  revalidatePath("/professor");
  revalidatePath("/aluno/agenda");
  revalidatePath("/aluno");
  revalidatePath("/familia/agenda");
  revalidatePath("/familia");
  redirect(`/professor/agenda?sucesso=${encodeURIComponent("Encontro criado e disponibilizado para os participantes selecionados.")}`);
}

export async function setAgendaEventStatus(formData: FormData) {
  const parsed = z.object({
    eventId: z.string().uuid(),
    status: z.enum(["scheduled", "completed", "cancelled"]),
  }).safeParse({
    eventId: formData.get("eventId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;

  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) return;
  const { error } = await supabase
    .from("agenda_events")
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.eventId)
    .eq("created_by_teacher_id", teacher.id);

  if (error) redirect(`/professor/agenda?erro=${encodeURIComponent("Não foi possível atualizar o encontro.")}`);
  revalidatePath("/professor/agenda");
  revalidatePath("/aluno/agenda");
  revalidatePath("/familia/agenda");
  redirect(`/professor/agenda?sucesso=${encodeURIComponent(parsed.data.status === "cancelled" ? "Encontro cancelado." : "Situação do encontro atualizada.")}`);
}
