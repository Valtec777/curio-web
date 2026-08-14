"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { PlanResourceKey } from "@/lib/plan-usage";

// A reunião mensal com a família é configurada separadamente pelo motor de planos.
// Esta tela mantém os demais limites editáveis sem zerar essa regra ao salvar.
const resources: Exclude<PlanResourceKey, "family_meetings">[] = ["meetings", "missions", "assessments", "notebooks", "materials", "courses"];

function parseLimit(value: FormDataEntryValue | null) {
  const raw = String(value || "").trim();
  if (!raw) return { ok: true as const, value: null as number | null };
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1000) return { ok: false as const, value: null };
  return { ok: true as const, value: parsed };
}

export async function updatePlanEntitlements(formData: FormData) {
  await requireRole("admin");
  const planId = z.string().uuid().safeParse(formData.get("planId"));
  if (!planId.success) redirect(`/admin/planos?erro=${encodeURIComponent("Plano inválido.")}`);
  const parsed = new Map<PlanResourceKey, number | null>();
  for (const resource of resources) {
    const result = parseLimit(formData.get(`${resource}Limit`));
    if (!result.ok) redirect(`/admin/planos?erro=${encodeURIComponent("Os limites precisam ser números inteiros entre 0 e 1000, ou ficar em branco para não ter limite definido.")}`);
    parsed.set(resource, result.value);
  }
  const supabase = await createClient();
  const [{ data: plan }, { data: familyMeetingRule }] = await Promise.all([
    supabase.from("plans").select("id").eq("id", planId.data).is("deleted_at", null).maybeSingle(),
    supabase.from("plan_entitlements").select("limit_per_cycle,enabled").eq("plan_id", planId.data).eq("resource_key", "family_meetings").maybeSingle(),
  ]);
  if (!plan) redirect(`/admin/planos?erro=${encodeURIComponent("Plano não encontrado.")}`);

  const studentMeetingLimit = parsed.get("meetings");
  const familyMeetingLimit = familyMeetingRule?.enabled === false ? 0 : Number(familyMeetingRule?.limit_per_cycle ?? 0);
  const totalMeetingDisplay = Number(studentMeetingLimit ?? 0) + familyMeetingLimit;
  const { error: meetingSyncError } = await supabase.from("plans").update({ meetings_per_month: totalMeetingDisplay, updated_at: new Date().toISOString() }).eq("id", planId.data);
  if (meetingSyncError) redirect(`/admin/planos?erro=${encodeURIComponent("Não foi possível atualizar o total de encontros exibido no plano.")}`);

  const rows = resources.map((resource) => {
    const limit = parsed.get(resource) ?? null;
    return { plan_id: planId.data, resource_key: resource, limit_per_cycle: limit, enabled: limit !== 0, hard_limit: limit !== null, warning_percent: 80, updated_at: new Date().toISOString() };
  });
  const { error } = await supabase.from("plan_entitlements").upsert(rows, { onConflict: "plan_id,resource_key" });
  if (error) redirect(`/admin/planos?erro=${encodeURIComponent("Não foi possível salvar todos os limites do plano.")}`);
  revalidatePath("/admin/planos"); revalidatePath("/professor/limites"); revalidatePath("/professor/alunos"); revalidatePath("/familia/plano"); revalidatePath("/");
  redirect(`/admin/planos?sucesso=${encodeURIComponent("Limites do plano atualizados. A reunião com a família continua separada das aulas do aluno.")}`);
}
