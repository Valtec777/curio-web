"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const allowed = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

function safeFileName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 110);
}

function paymentReturn(studentId: string | null | undefined, key: "erro" | "sucesso", message: string) {
  const params = new URLSearchParams();
  if (studentId) params.set("aluno", studentId);
  params.set(key, message);
  return `/familia/pagamentos?${params.toString()}`;
}

export async function submitPaymentReceipt(formData: FormData) {
  const viewer = await requireRole("guardian");
  const parsed = z.object({ paymentId: z.string().uuid() }).safeParse({ paymentId: formData.get("paymentId") });
  if (!parsed.success) redirect(paymentReturn(null, "erro", "Pagamento inválido."));

  const value = formData.get("receiptFile");
  const file = value instanceof File && value.size > 0 ? value : null;
  if (!file) redirect(paymentReturn(null, "erro", "Escolha o comprovante."));
  if (file.size > 10 * 1024 * 1024) redirect(paymentReturn(null, "erro", "O comprovante deve ter até 10 MB."));
  if (!allowed.has(file.type)) redirect(paymentReturn(null, "erro", "Envie PDF, PNG, JPG ou WEBP."));

  const supabase = await createClient();
  const { data: guardian } = await supabase.from("guardians").select("id,active").eq("profile_id", viewer.user.id).maybeSingle();
  if (!guardian?.active) redirect(paymentReturn(null, "erro", "Perfil da família não está ativo."));

  const { data: payment } = await supabase.from("payments").select("id,subscription_id,status").eq("id", parsed.data.paymentId).maybeSingle();
  if (!payment) redirect(paymentReturn(null, "erro", "Pagamento não encontrado."));
  const { data: subscription } = await supabase.from("subscriptions").select("id,guardian_id,student_id").eq("id", payment.subscription_id).maybeSingle();
  const studentId = subscription?.student_id || null;
  if (!subscription || subscription.guardian_id !== guardian.id) redirect(paymentReturn(studentId, "erro", "Este pagamento não pertence à sua família."));
  if (payment.status === "paid") redirect(paymentReturn(studentId, "sucesso", "Este pagamento já está confirmado."));

  const { data: pending } = await supabase.from("payment_receipts").select("id").eq("payment_id", payment.id).eq("status", "pending").maybeSingle();
  if (pending) redirect(paymentReturn(studentId, "sucesso", "Seu comprovante já está aguardando conferência."));

  const path = `${viewer.user.id}/${payment.id}/${Date.now()}-${safeFileName(file.name || "comprovante.pdf")}`;
  const { error: uploadError } = await supabase.storage.from("payment-receipts").upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) redirect(paymentReturn(studentId, "erro", "Não foi possível anexar o comprovante agora."));

  const { error } = await supabase.from("payment_receipts").insert({
    payment_id: payment.id,
    guardian_id: guardian.id,
    submitted_by_user_id: viewer.user.id,
    file_path: path,
    file_name: file.name,
    mime_type: file.type,
    status: "pending",
  });

  if (error) {
    await supabase.storage.from("payment-receipts").remove([path]);
    if (error.code === "23505") redirect(paymentReturn(studentId, "sucesso", "Seu comprovante já está aguardando conferência."));
    redirect(paymentReturn(studentId, "erro", "Não foi possível registrar o comprovante."));
  }

  revalidatePath("/familia/pagamentos");
  revalidatePath("/admin/financeiro");
  redirect(paymentReturn(studentId, "sucesso", "Comprovante enviado. A equipe CURIÓ vai conferir o Pix antes de confirmar o pagamento."));
}
