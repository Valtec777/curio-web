"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function releaseEligibleReferralRewards() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_release_eligible_referral_rewards");

  if (error) {
    console.error("Falha ao liberar recompensas elegíveis", error.code);
    redirect(`/admin/indicacoes?erro=${encodeURIComponent("Não foi possível atualizar as recompensas elegíveis.")}`);
  }

  const released = Number(data || 0);
  redirect(`/admin/indicacoes?sucesso=${encodeURIComponent(
    released > 0
      ? `${released} recompensa(s) elegível(is) liberada(s).`
      : "Nenhuma nova recompensa estava elegível agora."
  )}`);
}
