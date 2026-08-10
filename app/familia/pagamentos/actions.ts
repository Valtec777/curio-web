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

export async function submitPaymentReceipt(formData: FormData) {
  const viewer = await requireRole("guardian");
  const parsed = z.object({ paymentId: z.string().uuid() }).safeParse({ paymentId: formData.get("paymentId") });
  if (!parsed.success) redirect("/familia/pagamentos?erro=" + encodeURIComponent("Pagamento inválido."));

  const value = formData.get("receiptFile");
  const file = value instanceof File && value.size > 0 ? value : null;
  if (!file) redirect("/familia/pagamentos?erro=" + encodeURIComponent("Escolha o comprovante."));
  if (file.size > 10 * 1024 * 1024) redirect("/familia/pagamentos?erro=" + encodeURIComponent("O comprovante deve ter até 10 MB."));
  if (!allowed.has(file.type)) redirect("/familia/pagamentos?erro=" + encodeURIComponent("Envie PDF, PNG, JPG ou WEBP."));

  const supabase = await createClient();
  const { data: guardian } = await supabase.from("guardians").select("id,active").eq("profile_id", viewer.user.id).maybeSingle();
  if (!guardian?.active) redirect("/familia/pagamentos?erro=" + encodeURIComponent("Perfil da família não está ativo."));

  const { data: payment } = await supabase.from("payments").select("id,subscription_id,status").eq("id", parsed.data.paymentId).maybeSingle();
  if (!payment) redirect("/familia/pagamentos?erro=" + encodeURIComponent("Pagamento não encontrado."));
  const { data: subscription } = await supabase.from("subscriptions").select("id,guardian_id").eq("id", payment.subscription_id).maybeSingle();
  if (!subscription || subscription.guardian_id !== guardian.id) redirect("/familia/pagamentos?erro=" + encodeURIComponent("Este pagamento não pertence à sua família."));
  if (payment.status === "paid") redirect("/familia/pagamentos?sucesso=" + encodeURIComponent("Este pagamento já está confirmado."));

  const { data: pending } = await supabase.from("payment_receipts").select("id").eq("payment_id", payment.id).eq("status", "pending").maybeSingle();
  if (pending) redirect("/familia/pagamentos?sucesso=" + encodeURIComponent("Seu comprovante já está aguardando conferência."));

  const path = `${viewer.user.id}/${payment.id}/${Date.now()}-${safeFileName(file.name || "comprovante.pdf")}`;
  const { error: uploadError } = await supabase.storage.from("payment-receipts").upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) redirect("/familia/pagamentos?erro=" + encodeURIComponent("Não foi possível anexar o comprovante agora."));

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
    if (error.code === "23505") redirect("/familia/pagamentos?sucesso=" + encodeURIComponent("Seu comprovante já está aguardando conferência."));
    redirect("/familia/pagamentos?erro=" + encodeURIComponent("Não foi possível registrar o comprovante."));
  }

  revalidatePath("/familia/pagamentos");
  revalidatePath("/admin/financeiro");
  redirect("/familia/pagamentos?sucesso=" + encodeURIComponent("Comprovante enviado. A equipe CURIÓ vai conferir o Pix antes de confirmar o pagamento."));
}
