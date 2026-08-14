"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const MAX_BYTES = 10 * 1024 * 1024;
const allowed = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

function paymentReturn(studentId: string | null | undefined, key: "erro" | "sucesso", message: string) {
  const params = new URLSearchParams();
  if (studentId) params.set("aluno", studentId);
  params.set(key, message);
  return `/familia/pagamentos?${params.toString()}`;
}

async function removeReceiptFile(supabase: any, path?: string | null) {
  if (!path) return;
  await supabase.storage.from("payment-receipts").remove([path]);
}

export async function submitPaymentReceipt(formData: FormData) {
  const viewer = await requireRole("guardian");
  const parsed = z.object({
    paymentId: z.string().uuid(),
    receiptFilePath: z.string().trim().min(1).max(500),
    receiptFileName: z.string().trim().min(1).max(220),
    receiptMimeType: z.string().trim().min(1).max(180),
    receiptFileSize: z.coerce.number().int().positive().max(MAX_BYTES),
  }).safeParse({
    paymentId: formData.get("paymentId"),
    receiptFilePath: formData.get("receiptFilePath"),
    receiptFileName: formData.get("receiptFileName"),
    receiptMimeType: formData.get("receiptMimeType"),
    receiptFileSize: formData.get("receiptFileSize"),
  });
  if (!parsed.success) redirect(paymentReturn(null, "erro", "Comprovante inválido. Tente anexar o arquivo novamente."));

  const supabase = await createClient();
  const path = parsed.data.receiptFilePath;
  const expectedPrefix = `${viewer.user.id}/${parsed.data.paymentId}/`;
  if (!path.startsWith(expectedPrefix) || !allowed.has(parsed.data.receiptMimeType)) {
    if (path.startsWith(`${viewer.user.id}/`)) await removeReceiptFile(supabase, path);
    redirect(paymentReturn(null, "erro", "O comprovante enviado não é válido."));
  }

  const { data: guardian } = await supabase.from("guardians").select("id,active").eq("profile_id", viewer.user.id).maybeSingle();
  if (!guardian?.active) {
    await removeReceiptFile(supabase, path);
    redirect(paymentReturn(null, "erro", "Perfil da família não está ativo."));
  }

  const { data: payment } = await supabase.from("payments").select("id,subscription_id,status").eq("id", parsed.data.paymentId).maybeSingle();
  if (!payment) {
    await removeReceiptFile(supabase, path);
    redirect(paymentReturn(null, "erro", "Pagamento não encontrado."));
  }
  const { data: subscription } = await supabase.from("subscriptions").select("id,guardian_id,student_id").eq("id", payment.subscription_id).maybeSingle();
  const studentId = subscription?.student_id || null;
  if (!subscription || subscription.guardian_id !== guardian.id) {
    await removeReceiptFile(supabase, path);
    redirect(paymentReturn(studentId, "erro", "Este pagamento não pertence à sua família."));
  }
  if (payment.status === "paid") {
    await removeReceiptFile(supabase, path);
    redirect(paymentReturn(studentId, "sucesso", "Este pagamento já está confirmado."));
  }

  const { data: pending } = await supabase.from("payment_receipts").select("id").eq("payment_id", payment.id).eq("status", "pending").maybeSingle();
  if (pending) {
    await removeReceiptFile(supabase, path);
    redirect(paymentReturn(studentId, "sucesso", "Seu comprovante já está aguardando conferência."));
  }

  const { error } = await supabase.from("payment_receipts").insert({
    payment_id: payment.id,
    guardian_id: guardian.id,
    submitted_by_user_id: viewer.user.id,
    file_path: path,
    file_name: parsed.data.receiptFileName,
    mime_type: parsed.data.receiptMimeType,
    status: "pending",
  });

  if (error) {
    await removeReceiptFile(supabase, path);
    if (error.code === "23505") redirect(paymentReturn(studentId, "sucesso", "Seu comprovante já está aguardando conferência."));
    redirect(paymentReturn(studentId, "erro", "Não foi possível registrar o comprovante."));
  }

  revalidatePath("/familia/pagamentos");
  revalidatePath("/admin/financeiro");
  redirect(paymentReturn(studentId, "sucesso", "Comprovante enviado. A equipe CURIÓ vai conferir o Pix antes de confirmar o pagamento."));
}
