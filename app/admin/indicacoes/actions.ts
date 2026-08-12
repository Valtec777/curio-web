"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const statusSchema = z.enum(["new", "converted", "qualified", "rewarded", "rejected"]);

export async function setReferralStatus(formData: FormData) {
  await requireRole("admin");
  const id = String(formData.get("id") || "");
  const parsed = statusSchema.safeParse(formData.get("status"));
  if (!id || !parsed.success) redirect("/admin/indicacoes?erro=Dados+inválidos");

  const supabase = await createClient();
  const { error } = await supabase
    .from("referral_leads")
    .update({ status: parsed.data })
    .eq("id", id);

  if (error) {
    const message = error.message.includes("janela mínima")
      ? "A indicação ainda não completou os 30 dias mínimos após a conversão."
      : error.message.includes("Teto de recompensas")
        ? "O teto de recompensas deste indicador já foi atingido no período."
        : error.message.includes("conversão")
          ? "Registre a conversão antes de qualificar ou recompensar."
          : "Não foi possível alterar a indicação.";
    redirect(`/admin/indicacoes?erro=${encodeURIComponent(message)}`);
  }

  redirect(`/admin/indicacoes?sucesso=${encodeURIComponent(`Indicação atualizada para ${parsed.data}.`)}`);
}
