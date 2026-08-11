"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getFamilyPortal } from "@/lib/family";

const responseSchema = z.object({
  eventId: z.string().uuid(),
  studentId: z.string().uuid(),
  response: z.enum(["confirmed", "unavailable"]),
  note: z.string().max(1000).optional(),
});

export async function respondToAgendaEvent(formData: FormData) {
  const parsed = responseSchema.safeParse({
    eventId: formData.get("eventId"),
    studentId: formData.get("studentId"),
    response: formData.get("response"),
    note: String(formData.get("note") || ""),
  });

  if (!parsed.success) {
    redirect(`/familia/agenda?erro=${encodeURIComponent("Não foi possível registrar essa resposta.")}`);
  }

  const { selectedChild, supabase } = await getFamilyPortal(parsed.data.studentId);
  if (!selectedChild || selectedChild.student_id !== parsed.data.studentId) {
    redirect(`/familia/agenda?erro=${encodeURIComponent("Essa criança não está vinculada ao seu perfil.")}`);
  }

  const { error } = await supabase.rpc("respond_to_agenda_event", {
    p_event_id: parsed.data.eventId,
    p_student_id: parsed.data.studentId,
    p_response: parsed.data.response,
    p_note: parsed.data.note?.trim() || null,
  });

  if (error) {
    redirect(`/familia/agenda?aluno=${encodeURIComponent(parsed.data.studentId)}&erro=${encodeURIComponent("Não foi possível salvar sua resposta. Atualize a página e tente novamente.")}`);
  }

  revalidatePath("/familia/agenda");
  revalidatePath("/professor/agenda");
  const message = parsed.data.response === "confirmed" ? "Presença confirmada." : "Aviso de ausência registrado.";
  redirect(`/familia/agenda?aluno=${encodeURIComponent(parsed.data.studentId)}&sucesso=${encodeURIComponent(message)}`);
}
