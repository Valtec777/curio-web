import { createClient } from "@/lib/supabase/server";

export type ReferralOwnerType = "guardian" | "teacher";

export type ReferralRule = {
  reward_amount: number | string;
  qualification_days: number;
  max_rewards_period: number;
  period_days: number;
  active: boolean;
  public_rules?: string | null;
};

export type ReferralSummary = {
  code?: string | null;
  total_referrals: number;
  confirmed_referrals: number;
  available_benefits: number;
  program_active: boolean;
  public_rules?: string | null;
};

export type ReferralActivity = {
  referral_id: string;
  guardian_name?: string | null;
  child_name?: string | null;
  status: string;
  created_at: string;
  enrolled_at?: string | null;
  confirmed_at?: string | null;
};

const FALLBACK_RULES: Record<ReferralOwnerType, ReferralRule> = {
  guardian: {
    reward_amount: 30,
    qualification_days: 30,
    max_rewards_period: 3,
    period_days: 365,
    active: true,
  },
  teacher: {
    reward_amount: 40,
    qualification_days: 30,
    max_rewards_period: 5,
    period_days: 30,
    active: true,
  },
};

export async function getReferralDashboard(ownerType: ReferralOwnerType) {
  const supabase = await createClient();

  const { data: ensured, error: ensureError } = await supabase.rpc("ensure_my_referral_code", {
    p_owner_type: ownerType,
  });

  if (ensureError) {
    console.error("Falha ao garantir código de indicação", ensureError.code);
  }

  const [summaryResult, ruleResult, activityResult] = await Promise.all([
    supabase.rpc("my_referral_summary", { p_owner_type: ownerType }),
    supabase.rpc("my_referral_rule", { p_owner_type: ownerType }),
    supabase.rpc("my_referral_activity", { p_owner_type: ownerType }),
  ]);

  if (summaryResult.error) console.error("Falha ao carregar resumo de indicação", summaryResult.error.code);
  // my_referral_rule é adicionado pela migration deste branch; enquanto ela ainda não
  // estiver aplicada, a tela usa exatamente os mesmos valores conservadores do SQL.
  if (ruleResult.error && ruleResult.error.code !== "PGRST202") {
    console.error("Falha ao carregar regra de indicação", ruleResult.error.code);
  }
  if (activityResult.error) console.error("Falha ao carregar atividade de indicação", activityResult.error.code);

  const ensuredRow = Array.isArray(ensured) ? ensured[0] : ensured;
  const summaryRow = (Array.isArray(summaryResult.data) ? summaryResult.data[0] : summaryResult.data) as ReferralSummary | null;
  const ruleRow = (Array.isArray(ruleResult.data) ? ruleResult.data[0] : ruleResult.data) as ReferralRule | null;
  const activity = (Array.isArray(activityResult.data) ? activityResult.data : []) as ReferralActivity[];

  return {
    code: summaryRow?.code || ensuredRow?.code || null,
    summary: summaryRow || {
      code: ensuredRow?.code || null,
      total_referrals: 0,
      confirmed_referrals: 0,
      available_benefits: 0,
      program_active: false,
      public_rules: null,
    },
    rule: ruleRow || FALLBACK_RULES[ownerType],
    activity,
  };
}
