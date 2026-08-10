"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function reviewPaymentReceipt(formData: FormData) {
  await requireRole("admin");
  const parsed = z.object({
    receiptId: z.string().uuid(),
    decision: z.enum(["approve", "reject"]),
    note: z.string().max(500).optional(),
  }).safeParse({
    receiptId: formData.get("receiptId"),
    decision: formData.get("decision"),
    note: String(formData.get("note") || ""),
  });
  if (!parsed.success) redirect("/admin/financeiro?erro=" + encodeURIComponent("Revise a decisão do comprovante."));

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_payment_receipt", {
    p_receipt_id: parsed.data.receiptId,
    p_approved: parsed.data.decision === "approve",
    p_note: parsed.data.note?.trim() || null,
  });
  if (error) redirect("/admin/financeiro?erro=" + encodeURIComponent("Não foi possível concluir a conferência. Verifique se o comprovante ainda está pendente."));

  revalidatePath("/admin/financeiro");
  revalidatePath("/familia/pagamentos");
  redirect("/admin/financeiro?sucesso=" + encodeURIComponent(parsed.data.decision === "approve" ? "Comprovante aprovado e mensalidade marcada como paga." : "Comprovante recusado. A família poderá enviar outro arquivo."));
}
