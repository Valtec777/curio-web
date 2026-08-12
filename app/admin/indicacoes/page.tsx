import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { releaseEligibleReferralRewards } from "@/app/admin/indicacoes/actions";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bahia" }).format(new Date(value));
}

function money(value?: number | string | null) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function statusLabel(status: string) {
  if (status === "lead") return "Interesse";
  if (status === "enrolled") return "Matriculado";
  if (status === "payment_confirmed") return "1º pagamento confirmado";
  if (status === "cancelled") return "Cancelado";
  return status;
}

function statusTone(status: string): "green" | "yellow" | "blue" | "neutral" {
  if (status === "payment_confirmed") return "green";
  if (status === "enrolled") return "blue";
  if (status === "lead") return "yellow";
  return "neutral";
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] || null : value || null;
}

export default async function AdminReferralsPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  await requireRole("admin");
  const query = await searchParams;
  const supabase = await createClient();

  const [referralsResult, rulesResult, settingsResult, familyBenefitsResult, teacherRewardsResult] = await Promise.all([
    supabase
      .from("referrals")
      .select("id,status,created_at,enrolled_at,confirmed_at,referral_codes(code,owner_type),subscriptions(status)")
      .order("created_at", { ascending: false })
      .limit(150),
    supabase.from("referral_reward_rules").select("owner_type,reward_amount,qualification_days,max_rewards_period,period_days,active").order("owner_type"),
    supabase.from("referral_program_settings").select("active,public_rules").limit(1).maybeSingle(),
    supabase.from("referral_benefits").select("referral_id,status,benefit_amount,available_at,applied_at").order("available_at", { ascending: false }).limit(150),
    supabase.from("referral_teacher_rewards").select("referral_id,status,reward_amount,available_at,paid_at").order("available_at", { ascending: false }).limit(150),
  ]);

  const referrals = referralsResult.data ?? [];
  const rules = rulesResult.data ?? [];
  const familyBenefits = familyBenefitsResult.data ?? [];
  const teacherRewards = teacherRewardsResult.data ?? [];
  const familyRewardByReferral = new Map(familyBenefits.map((item: any) => [item.referral_id, item]));
  const teacherRewardByReferral = new Map(teacherRewards.map((item: any) => [item.referral_id, item]));
  const rulesByOwner = new Map(rules.map((rule: any) => [rule.owner_type, rule]));
  const availableFamily = familyBenefits.filter((item: any) => item.status === "available");
  const availableTeacher = teacherRewards.filter((item: any) => item.status === "available");
  const availableValue = availableFamily.reduce((sum: number, item: any) => sum + Number(item.benefit_amount || 0), 0)
    + availableTeacher.reduce((sum: number, item: any) => sum + Number(item.reward_amount || 0), 0);

  return (
    <>
      <PageHeader
        eyebrow="Operação CURIÓ"
        title="Indicações"
        description="O sistema registra o link, acompanha matrícula e primeiro pagamento. Recompensas só ficam disponíveis após retenção e dentro dos tetos."
        action={
          <form action={releaseEligibleReferralRewards}>
            <button className="button button-primary" type="submit">Atualizar elegíveis</button>
          </form>
        }
      />

      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}
      {!settingsResult.data?.active && <div className="form-message form-error">O programa está desativado no banco. A migration deste PR precisa ser aplicada antes de divulgar os links.</div>}

      <div className="stats-grid">
        <StatCard value={referrals.length} label="Indicações registradas" />
        <StatCard value={referrals.filter((item: any) => item.status === "payment_confirmed").length} label="Com 1º pagamento" />
        <StatCard value={availableFamily.length + availableTeacher.length} label="Recompensas disponíveis" />
        <StatCard value={money(availableValue)} label="Valor disponível" />
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Regras de proteção de margem</h2>
            <p>O primeiro pagamento confirma a conversão, mas não libera recompensa na hora.</p>
          </div>
        </div>
        <div className="grid-2">
          {rules.length ? rules.map((rule: any) => (
            <article className="mission-card" key={rule.owner_type}>
              <Badge tone={rule.active ? "green" : "neutral"}>{rule.owner_type === "guardian" ? "Famílias" : "Professores"}</Badge>
              <h3>{money(rule.reward_amount)} por indicação elegível</h3>
              <p>{rule.qualification_days} dias mínimos com assinatura ativa após o primeiro pagamento.</p>
              <p className="muted mb-0">Teto: {rule.max_rewards_period} recompensa(s) a cada {rule.period_days >= 365 ? "12 meses" : `${rule.period_days} dias`}.</p>
            </article>
          )) : <p className="muted">As regras entram com a migration deste PR.</p>}
        </div>
        {settingsResult.data?.public_rules && <p className="muted">{settingsResult.data.public_rules}</p>}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Fila automática</h2>
            <p>Não é necessário marcar conversão manualmente: matrícula e pagamento vêm do fluxo financeiro real.</p>
          </div>
        </div>

        {referrals.length ? (
          <div className="form-stack">
            {referrals.map((item: any) => {
              const code = firstRelation<any>(item.referral_codes);
              const subscription = firstRelation<any>(item.subscriptions);
              const rule: any = rulesByOwner.get(code?.owner_type);
              const reward = code?.owner_type === "teacher"
                ? teacherRewardByReferral.get(item.id)
                : familyRewardByReferral.get(item.id);
              const qualifiedByTime = item.status === "payment_confirmed"
                && item.confirmed_at
                && rule?.qualification_days
                && new Date(item.confirmed_at).getTime() <= Date.now() - Number(rule.qualification_days) * 86400000;

              return (
                <article className="mission-card" key={item.id}>
                  <div className="flex space-between gap-8 wrap">
                    <div>
                      <div className="flex gap-8 wrap align-center">
                        <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
                        <Badge tone="neutral">{code?.owner_type === "teacher" ? "Professor" : "Família"}</Badge>
                        {subscription?.status && <Badge tone={subscription.status === "active" ? "green" : "neutral"}>Assinatura {subscription.status}</Badge>}
                      </div>
                      <h3>Código {code?.code || "—"}</h3>
                      <p>Registrada em {dt(item.created_at)} · matrícula {dt(item.enrolled_at)} · pagamento {dt(item.confirmed_at)}</p>
                    </div>
                    <div>
                      {reward ? (
                        <><strong>{money(reward.benefit_amount ?? reward.reward_amount)}</strong><p className="muted mb-0">Recompensa {reward.status}</p></>
                      ) : qualifiedByTime ? (
                        <><strong>Retenção cumprida</strong><p className="muted mb-0">A liberação ainda depende de assinatura ativa e teto.</p></>
                      ) : (
                        <><strong>Sem recompensa ainda</strong><p className="muted mb-0">Aguardando ciclo de elegibilidade.</p></>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : <EmptyState title="Nenhuma indicação ainda" description="Assim que alguém enviar o formulário por um link válido, o registro aparecerá aqui." />}
      </section>

      <section className="panel">
        <h2 className="mt-0">Importante</h2>
        <p className="muted mb-0">“Disponível” não significa aplicado. Crédito de família e bônus de professor ficam separados da cobrança e do pagamento até a conferência administrativa.</p>
      </section>
    </>
  );
}
