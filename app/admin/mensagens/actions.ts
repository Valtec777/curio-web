"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  studentId: z.string().uuid(),
  guardianId: z.string().uuid(),
  subject: z.string().trim().min(2).max(160),
  body: z.string().trim().min(1).max(5000),
  actionLabel: z.string().trim().max(80).optional(),
  actionUrl: z.string().trim().max(1000).optional(),
  requestKey: z.string().min(8).max(160),
}).refine((data) => Boolean(data.actionLabel) === Boolean(data.actionUrl), {
  message: "Preencha o texto e o destino do botão juntos.",
});

export async function sendAdminFamilyMessage(formData: FormData) {
  await requireRole("admin");
  const parsed = schema.safeParse({
    studentId: formData.get("studentId"),
    guardianId: formData.get("guardianId"),
    subject: formData.get("subject"),
    body: formData.get("body"),
    actionLabel: String(formData.get("actionLabel") || ""),
    actionUrl: String(formData.get("actionUrl") || ""),
    requestKey: formData.get("requestKey"),
  });
  if (!parsed.success) redirect("/admin/mensagens?erro=" + encodeURIComponent(parsed.error.issues[0]?.message || "Revise a mensagem."));

  const supabase = await createClient();
  const { error } = await supabase.rpc("send_curio_family_message", {
    p_student_id: parsed.data.studentId,
    p_guardian_id: parsed.data.guardianId,
    p_subject: parsed.data.subject,
    p_body: parsed.data.body,
    p_action_label: parsed.data.actionLabel || null,
    p_action_url: parsed.data.actionUrl || null,
    p_request_key: parsed.data.requestKey,
  });
  if (error) redirect("/admin/mensagens?erro=" + encodeURIComponent("Não foi possível enviar a mensagem para essa família."));

  revalidatePath("/admin/mensagens");
  revalidatePath("/familia/mensagens");
  redirect("/admin/mensagens?sucesso=" + encodeURIComponent("Mensagem enviada para a família."));
}
