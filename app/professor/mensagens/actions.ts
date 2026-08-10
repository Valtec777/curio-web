"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentTeacher } from "@/lib/teacher";

const schema = z.object({
  threadId: z.string().uuid().optional().or(z.literal("")),
  target: z.string().max(180).optional(),
  body: z.string().trim().min(1).max(5000),
  requestKey: z.string().min(8).max(160),
});

export async function sendTeacherChatMessage(formData: FormData) {
  const parsed = schema.safeParse({
    threadId: String(formData.get("threadId") || ""),
    target: String(formData.get("target") || ""),
    body: formData.get("body"),
    requestKey: formData.get("requestKey"),
  });
  if (!parsed.success) redirect(`/professor/mensagens?erro=${encodeURIComponent("Escreva uma mensagem antes de enviar.")}`);

  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) redirect("/professor/mensagens");

  let targetKind = "";
  let studentId = "";
  let guardianId = "";

  if (!parsed.data.threadId) {
    const [kind, student, guardian = ""] = String(parsed.data.target || "").split("|");
    if (!(["family", "student"] as string[]).includes(kind) || !z.string().uuid().safeParse(student).success) {
      redirect(`/professor/mensagens?erro=${encodeURIComponent("Escolha com quem deseja iniciar a conversa.")}`);
    }
    if (kind === "family" && !z.string().uuid().safeParse(guardian).success) {
      redirect(`/professor/mensagens?erro=${encodeURIComponent("Escolha um responsável válido.")}`);
    }
    targetKind = kind;
    studentId = student;
    guardianId = guardian;
  }

  const { data, error } = await supabase.rpc("send_teacher_chat_message", {
    p_thread_id: parsed.data.threadId || null,
    p_target_kind: targetKind || null,
    p_student_id: studentId || null,
    p_guardian_id: guardianId || null,
    p_body: parsed.data.body,
    p_request_key: parsed.data.requestKey,
  });

  if (error) {
    console.error("Falha ao enviar conversa do professor", error.code);
    redirect(`/professor/mensagens?erro=${encodeURIComponent("Não foi possível enviar a mensagem agora. Tente novamente.")}`);
  }

  const result = Array.isArray(data) ? data[0] : data;
  const threadId = result?.thread_id || parsed.data.threadId;

  revalidatePath("/professor");
  revalidatePath("/professor/mensagens");
  revalidatePath("/familia/mensagens");
  revalidatePath("/aluno");
  if (threadId) redirect(`/professor/mensagens?conversa=${threadId}`);
  redirect("/professor/mensagens");
}
