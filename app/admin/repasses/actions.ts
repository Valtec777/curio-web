"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/);

function refreshPayouts() {
  revalidatePath("/admin/repasses");
  revalidatePath("/professor/repasses");
  revalidatePath("/admin/planos");
}

export async function generateTeacherPayouts(formData: FormData) {
  await requireRole("admin");
  const month = monthSchema.safeParse(String(formData.get("referenceMonth") || ""));
  if (!month.success) redirect(`/admin/repasses?erro=${encodeURIComponent("Informe uma competência válida.")}`);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_teacher_payouts", { p_reference_month: `${month.data}-01` });
  if (error) redirect(`/admin/repasses?mes=${month.data}&erro=${encodeURIComponent("Não foi possível recalcular os repasses desta competência.")}`);

  refreshPayouts();
  redirect(`/admin/repasses?mes=${month.data}&sucesso=${encodeURIComponent(`${Number(data || 0)} repasse(s) revisado(s) pela regra atual.`)}`);
}

const adjustmentSchema = z.preprocess(
  (value) => String(value || "").trim() === "" ? 0 : Number(value),
  z.number().finite().min(-1000000).max(1000000),
);

export async function reviewTeacherPayout(formData: FormData) {
  const viewer = await requireRole("admin");
  const parsed = z.object({
    payoutId: z.string().uuid(),
    decision: z.enum(["review", "approve", "paid", "block", "cancel"]),
    adjustmentAmount: adjustmentSchema,
    adjustmentReason: z.string().trim().max(500).optional(),
    adminNote: z.string().trim().max(1000).optional(),
  }).safeParse({
    payoutId: formData.get("payoutId"),
    decision: formData.get("decision"),
    adjustmentAmount: formData.get("adjustmentAmount"),
    adjustmentReason: String(formData.get("adjustmentReason") || ""),
    adminNote: String(formData.get("adminNote") || ""),
  });

  if (!parsed.success) redirect(`/admin/repasses?erro=${encodeURIComponent("Revise os dados do repasse.")}`);
  if (parsed.data.adjustmentAmount !== 0 && !parsed.data.adjustmentReason) {
    redirect(`/admin/repasses?erro=${encodeURIComponent("Ajustes manuais precisam de uma justificativa.")}`);
  }

  const supabase = await createClient();
  const { data: payout } = await supabase
    .from("teacher_payouts")
    .select("id,status,reference_month,family_amount,calculated_amount,adjustment_amount,final_amount")
    .eq("id", parsed.data.payoutId)
    .maybeSingle();
  if (!payout) redirect(`/admin/repasses?erro=${encodeURIComponent("Repasse não encontrado.")}`);

  const transitions: Record<string, string[]> = {
    review: ["pending", "blocked", "review"],
    approve: ["review"],
    paid: ["approved"],
    block: ["pending", "review", "blocked"],
    cancel: ["pending", "review", "blocked"],
  };
  if (!transitions[parsed.data.decision]?.includes(payout.status)) {
    redirect(`/admin/repasses?erro=${encodeURIComponent("Essa mudança de situação não é permitida para o repasse atual.")}`);
  }

  const calculated = Number(payout.calculated_amount || 0);
  const familyAmount = Number(payout.family_amount || 0);
  const adjustment = parsed.data.adjustmentAmount;
  const finalAmount = Math.round((calculated + adjustment) * 100) / 100;
  if (finalAmount < 0 || finalAmount > familyAmount) {
    redirect(`/admin/repasses?erro=${encodeURIComponent("O valor final precisa ficar entre R$ 0,00 e o valor pago pela família.")}`);
  }

  const now = new Date().toISOString();
  const status = parsed.data.decision === "approve" ? "approved"
    : parsed.data.decision === "paid" ? "paid"
    : parsed.data.decision === "block" ? "blocked"
    : parsed.data.decision === "cancel" ? "cancelled"
    : "review";

  const update: Record<string, unknown> = {
    status,
    adjustment_amount: adjustment,
    final_amount: finalAmount,
    adjustment_reason: parsed.data.adjustmentReason || null,
    admin_note: parsed.data.adminNote || null,
    updated_at: now,
  };
  if (status === "approved") {
    update.approved_at = now;
    update.approved_by_user_id = viewer.user.id;
  }
  if (status === "paid") {
    update.paid_at = now;
    update.paid_by_user_id = viewer.user.id;
  }
  if (status === "blocked") update.blocked_at = now;
  if (status === "cancelled") update.cancelled_at = now;

  const { error } = await supabase.from("teacher_payouts").update(update).eq("id", payout.id);
  const month = String(payout.reference_month || "").slice(0, 7);
  if (error) redirect(`/admin/repasses?mes=${month}&erro=${encodeURIComponent("Não foi possível atualizar o repasse.")}`);

  refreshPayouts();
  const labels: Record<string, string> = {
    review: "Repasse enviado para revisão.",
    approve: "Repasse aprovado.",
    paid: "Repasse marcado como pago.",
    block: "Repasse bloqueado para conferência.",
    cancel: "Repasse cancelado com o histórico preservado.",
  };
  redirect(`/admin/repasses?mes=${month}&sucesso=${encodeURIComponent(labels[parsed.data.decision])}`);
}

export async function updatePlanTeacherCompensation(formData: FormData) {
  await requireRole("admin");
  const optionalMoney = z.preprocess((value) => String(value || "").trim() === "" ? null : Number(value), z.number().positive().nullable());
  const optionalPercent = z.preprocess((value) => String(value || "").trim() === "" ? null : Number(value), z.number().positive().max(100).nullable());
  const optionalLimit = z.preprocess((value) => String(value || "").trim() === "" ? null : Number(value), z.number().int().min(0).max(1000).nullable());
  const parsed = z.object({
    planId: z.string().uuid(),
    model: z.enum(["none", "fixed_monthly", "percent_plan", "per_meeting"]),
    fixedAmount: optionalMoney,
    percent: optionalPercent,
    perMeeting: optionalMoney,
    meetingLimit: optionalLimit,
  }).safeParse({
    planId: formData.get("planId"),
    model: formData.get("model"),
    fixedAmount: formData.get("fixedAmount"),
    percent: formData.get("percent"),
    perMeeting: formData.get("perMeeting"),
    meetingLimit: formData.get("meetingLimit"),
  });
  if (!parsed.success) redirect(`/admin/repasses?erro=${encodeURIComponent("Revise a regra de remuneração do plano.")}`);

  const supabase = await createClient();
  const { data: plan } = await supabase.from("plans").select("id,name,monthly_price,meetings_per_month").eq("id", parsed.data.planId).maybeSingle();
  if (!plan) redirect(`/admin/repasses?erro=${encodeURIComponent("Plano não encontrado.")}`);

  const price = Number(plan.monthly_price || 0);
  const effectiveLimit = parsed.data.meetingLimit ?? Number(plan.meetings_per_month || 0);
  if (parsed.data.model === "fixed_monthly" && (!parsed.data.fixedAmount || parsed.data.fixedAmount > price)) {
    redirect(`/admin/repasses?erro=${encodeURIComponent("O valor fixo precisa ser positivo e não pode superar o valor mensal do plano.")}`);
  }
  if (parsed.data.model === "percent_plan" && !parsed.data.percent) {
    redirect(`/admin/repasses?erro=${encodeURIComponent("Informe o percentual de remuneração.")}`);
  }
  if (parsed.data.model === "per_meeting") {
    if (!parsed.data.perMeeting || effectiveLimit <= 0) redirect(`/admin/repasses?erro=${encodeURIComponent("Informe o valor por encontro e um limite remunerável maior que zero.")}`);
    if (parsed.data.perMeeting * effectiveLimit > price) redirect(`/admin/repasses?erro=${encodeURIComponent("Valor por encontro × limite remunerável não pode superar o valor mensal do plano.")}`);
  }

  const { error } = await supabase.from("plans").update({
    teacher_compensation_model: parsed.data.model,
    teacher_compensation_fixed_amount: parsed.data.model === "fixed_monthly" ? parsed.data.fixedAmount : null,
    teacher_compensation_percent: parsed.data.model === "percent_plan" ? parsed.data.percent : null,
    teacher_compensation_per_meeting: parsed.data.model === "per_meeting" ? parsed.data.perMeeting : null,
    teacher_compensation_meeting_limit: parsed.data.model === "per_meeting" ? parsed.data.meetingLimit : null,
    updated_at: new Date().toISOString(),
  }).eq("id", plan.id);
  if (error) redirect(`/admin/repasses?erro=${encodeURIComponent("Não foi possível salvar a remuneração do plano.")}`);

  const { error: bootstrapError } = await supabase.rpc("bootstrap_legacy_subscription_compensation", { p_plan_id: plan.id });
  if (bootstrapError) redirect(`/admin/repasses?erro=${encodeURIComponent("A regra foi salva, mas as matrículas antigas precisam ser revisadas antes de gerar repasses.")}`);

  refreshPayouts();
  redirect(`/admin/repasses?sucesso=${encodeURIComponent(`Remuneração do plano ${plan.name} atualizada e registrada nas matrículas que ainda não tinham snapshot.`)}`);
}
