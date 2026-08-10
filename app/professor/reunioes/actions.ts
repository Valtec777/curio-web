"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentTeacher } from "@/lib/teacher";

function goError(message: string): never {
  redirect(`/professor/reunioes?erro=${encodeURIComponent(message)}`);
}

function parseBahiaDateTime(value: string) {
  const normalized = value.length === 16 ? `${value}:00` : value;
  const parsed = new Date(`${normalized}-03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function createTeacherMeeting(formData: FormData) {
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) goError("Perfil de professor não encontrado.");

  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const startsAtRaw = String(formData.get("startsAt") || "").trim();
  const meetingUrl = String(formData.get("meetingUrl") || "").trim();
  const studentId = String(formData.get("studentId") || "").trim();
  const visibleToStudent = formData.get("visibleToStudent") === "on";
  const visibleToGuardian = formData.get("visibleToGuardian") === "on";
  const durationMinutes = Number(formData.get("durationMinutes") || 30);

  if (!title) goError("Informe o motivo/título da reunião.");
  if (title.length > 160) goError("Use um título mais curto.");

  const startsAt = parseBahiaDateTime(startsAtRaw);
  if (!startsAt) goError("Informe uma data e hora válidas.");
  if (startsAt.getTime() < Date.now() - 5 * 60 * 1000) goError("A reunião precisa ser agendada para um horário futuro.");

  if (![15, 30, 45, 60, 90, 120].includes(durationMinutes)) {
    goError("Escolha uma duração válida.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(meetingUrl);
  } catch {
    goError("Cole um link válido do Google Meet.");
  }
  if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "meet.google.com") {
    goError("O link precisa começar com https://meet.google.com/.");
  }

  if ((visibleToStudent || visibleToGuardian) && !studentId) {
    goError("Escolha o aluno quando a reunião for visível para aluno ou família.");
  }

  if (studentId) {
    const { data: teacherStudent, error: relationError } = await supabase
      .from("teacher_students")
      .select("student_id")
      .eq("teacher_id", teacher.id)
      .eq("student_id", studentId)
      .eq("active", true)
      .maybeSingle();

    if (relationError || !teacherStudent) {
      goError("Você só pode agendar para alunos vinculados ao seu perfil.");
    }
  }

  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  const { data: event, error: eventError } = await supabase
    .from("agenda_events")
    .insert({
      created_by_teacher_id: teacher.id,
      title,
      description: description || null,
      event_type: "meeting",
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: "scheduled",
      meeting_url: parsedUrl.toString(),
      location: "Google Meet",
      visible_to_student: visibleToStudent,
      visible_to_guardian: visibleToGuardian,
    })
    .select("id")
    .single();

  if (eventError || !event) {
    goError(eventError?.message || "Não foi possível agendar a reunião.");
  }

  if (studentId) {
    const { error: linkError } = await supabase
      .from("agenda_event_students")
      .insert({ event_id: event.id, student_id: studentId });

    if (linkError) {
      await supabase.from("agenda_events").delete().eq("id", event.id);
      goError(linkError.message || "Não foi possível vincular o aluno à reunião.");
    }
  }

  revalidatePath("/professor/reunioes");
  revalidatePath("/professor/agenda");
  revalidatePath("/familia/agenda");
  revalidatePath("/aluno/agenda");
  revalidatePath("/admin/calendario");
  redirect("/professor/reunioes?sucesso=Reunião agendada com sucesso");
}
