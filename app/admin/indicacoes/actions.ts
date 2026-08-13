"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const optionalMoney = z.preprocess((value) => String(value || "").trim() === "" ? null : Number(value), z.number().positive().nullable());
const optionalPercent = z.preprocess((value) => String(value || "").trim() === "" ? null : Number(value), z.number().positive().max(100).nullable());
const optionalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal(""));

function refresh() {
  revalidatePath("/admin/indicacoes");
  revalidatePath("/familia/indicacoes");
  revalidatePath("/professor/indicacoes");
}

export async function updateReferralProgram(formData: FormData) {
  await requireRole("admin");
  const parsed = z.object({
    ownerType: z.enum(["guardian", "teacher"]),
    benefitType: z.enum(["none", "percent_discount", "fixed_discount", "extra_resource"]),
    benefitPercent: optionalPercent,
    benefitAmount: optionalMoney,
    extraResourceKey: z.string().trim().max(60).optional(),
    requiredConfirmedReferrals: z.coerce.number().int().min(1).max(100),
    startsAt: optionalDate,
    endsAt: optionalDate,
    publicRules: z.string().trim().max(1500).optional(),
  }).safeParse({
    ownerType: formData.get("ownerType"),
    benefitType: formData.get("benefitType"),
    benefitPercent: formData.get("benefitPercent"),
    benefitAmount: formData.get("benefitAmount"),
    extraResourceKey: String(formData.get("extraResourceKey") || ""),
    requiredConfirmedReferrals: formData.get("requiredConfirmedReferrals"),
    startsAt: String(formData.get("startsAt") || ""),
    endsAt: String(formData.get("endsAt") || ""),
    publicRules: String(formData.get("publicRules") || ""),
  });
  if (!parsed.success) redirect(`/admin/indicacoes?erro=${encodeURIComponent("Revise as regras do programa de indicações.")}`);

  if (parsed.data.benefitType === "percent_discount" && !parsed.data.benefitPercent) redirect(`/admin/indicacoes?erro=${encodeURIComponent("Informe o percentual do benefício.")}`);
  if (parsed.data.benefitType === "fixed_discount" && !parsed.data.benefitAmount) redirect(`/admin/indicacoes?erro=${encodeURIComponent("Informe o valor do benefício.")}`);
  if (parsed.data.benefitType === "extra_resource" && !parsed.data.extraResourceKey) redirect(`/admin/indicacoes?erro=${encodeURIComponent("Escolha o recurso extra que será liberado.")}`);
  if (parsed.data.startsAt && parsed.data.endsAt && parsed.data.endsAt < parsed.data.startsAt) redirect(`/admin/indicacoes?erro=${encodeURIComponent("A data final precisa ser posterior à data inicial.")}`);

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data: current } = await supabase
    .from("referral_program_settings")
    .select("id")
    .eq("owner_type", parsed.data.ownerType)
    .maybeSingle();
  if (!current) redirect(`/admin/indicacoes?erro=${encodeURIComponent("A configuração de indicações não foi encontrada.")}`);

  const { error } = await supabase.from("referral_program_settings").update({
    active: formData.get("active") === "on",
    benefit_type: parsed.data.benefitType,
    benefit_percent: parsed.data.benefitType === "percent_discount" ? parsed.data.benefitPercent : null,
    benefit_amount: parsed.data.benefitType === "fixed_discount" ? parsed.data.benefitAmount : null,
    extra_resource_key: parsed.data.benefitType === "extra_resource" ? parsed.data.extraResourceKey : null,
    required_confirmed_referrals: parsed.data.requiredConfirmedReferrals,
    starts_at: parsed.data.startsAt || null,
    ends_at: parsed.data.endsAt || null,
    public_rules: parsed.data.publicRules || null,
    updated_by_user_id: userData.user?.id || null,
    updated_at: new Date().toISOString(),
  }).eq("id", current.id);

  if (error) redirect(`/admin/indicacoes?erro=${encodeURIComponent("Não foi possível salvar as regras do programa.")}`);
  refresh();
  const label = parsed.data.ownerType === "teacher" ? "Professor" : "Família";
  redirect("/admin/indicacoes?sucesso=" + encodeURIComponent("Campanha de indicação para " + label + " atualizada."));
}

export async function reviewReferralBenefit(formData: FormData) {
  await requireRole("admin");
  const parsed = z.object({
    benefitId: z.string().uuid(),
    decision: z.enum(["apply", "cancel"]),
    note: z.string().trim().max(500).optional(),
  }).safeParse({
    benefitId: formData.get("benefitId"),
    decision: formData.get("decision"),
    note: String(formData.get("note") || ""),
  });
  if (!parsed.success) redirect(`/admin/indicacoes?erro=${encodeURIComponent("Revise a ação do benefício.")}`);

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("referral_benefits").update({
    status: parsed.data.decision === "apply" ? "applied" : "cancelled",
    applied_at: parsed.data.decision === "apply" ? new Date().toISOString() : null,
    applied_by_user_id: userData.user?.id || null,
    admin_note: parsed.data.note || null,
    updated_at: new Date().toISOString(),
  }).eq("id", parsed.data.benefitId).eq("status", "available");

  if (error) redirect(`/admin/indicacoes?erro=${encodeURIComponent("Não foi possível atualizar o benefício.")}`);
  refresh();
  redirect(`/admin/indicacoes?sucesso=${encodeURIComponent(parsed.data.decision === "apply" ? "Benefício marcado como utilizado." : "Benefício encerrado.")}`);
}
