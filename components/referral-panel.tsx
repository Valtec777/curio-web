import { CopyReferralLink } from "@/components/copy-referral-link";
import { Badge, StatCard } from "@/components/ui";
import type { ReferralActivity, ReferralRule, ReferralSummary } from "@/lib/referrals";

function money(value: number | string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

function shortDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Bahia" }).format(new Date(value));
}

function statusLabel(status: string) {
  if (status === "lead") return "Interesse recebido";
  if (status === "enrolled") return "Matrícula confirmada";
  if (status === "payment_confirmed") return "Pagamento confirmado";
  if (status === "cancelled") return "Encerrada";
  return status;
}

function statusTone(status: string): "blue" | "green" | "yellow" | "neutral" {
  if (status === "payment_confirmed") return "green";
  if (status === "enrolled") return "blue";
  if (status === "lead") return "yellow";
  return "neutral";
}

export function ReferralPanel({
  role,
  code,
  url,
  rule,
  summary,
  activity,
}: {
  role: "guardian" | "teacher";
  code?: string | null;
  url?: string | null;
  rule: ReferralRule;
  summary: ReferralSummary;
  activity: ReferralActivity[];
}) {
  const family = role === "guardian";
  const reward = Number(rule.reward_amount);
  const periodLabel = rule.period_days >= 365 ? "12 meses" : rule.period_days === 30 ? "30 dias" : `${rule.period_days} dias`;
  const programActive = Boolean(summary.program_active && rule.active);

  if (!code || !url || !programActive) {
    return (
      <section className="panel">
        <h2 className="mt-0">Seu link de indicação</h2>
        <p className="muted">
          {code
            ? "Seu código já existe, mas o programa ainda está desativado no banco. O link será liberado assim que a migration de ativação for aplicada."
            : "Não foi possível gerar seu código de indicação agora. A equipe pode revisar o vínculo deste perfil."}
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="panel family-highlight">
        <div className="eyebrow">Indique o CURIÓ</div>
        <h2>{family ? "Compartilhe com outra família" : "Indique para famílias que podem se beneficiar"}</h2>
        <p>
          O link registra a origem da indicação. A recompensa só fica disponível depois da primeira mensalidade confirmada e de {rule.qualification_days} dias com a assinatura ativa. A família convidada não recebe desconto automático por entrar pelo link.
        </p>
        <CopyReferralLink url={url} />
      </section>

      <div className="stats-grid">
        <StatCard value={summary.total_referrals ?? 0} label="Indicações registradas" />
        <StatCard value={summary.confirmed_referrals ?? 0} label="Com pagamento confirmado" />
        <StatCard value={summary.available_benefits ?? 0} label={family ? "Créditos disponíveis" : "Bônus disponíveis"} />
      </div>

      <div className="grid-2">
        <section className="panel">
          <h2 className="mt-0">Como funciona</h2>
          <ol className="referral-policy">
            <li>Você compartilha seu link individual.</li>
            <li>A família interessada envia o formulário pelo link.</li>
            <li>O sistema acompanha matrícula e primeira mensalidade paga.</li>
            <li>A indicação precisa permanecer com assinatura ativa por pelo menos {rule.qualification_days} dias depois do primeiro pagamento.</li>
            <li>Quando elegível e dentro do teto, fica disponível {family ? "um crédito" : "um bônus"} de {money(reward)}.</li>
          </ol>
        </section>

        <section className="panel">
          <h2 className="mt-0">Proteções para o programa continuar saudável</h2>
          <div className="form-stack">
            <div className="mission-card"><strong>{money(reward)}</strong><p>Valor fixo por indicação elegível; não é percentual da mensalidade.</p></div>
            <div className="mission-card"><strong>Máximo de {rule.max_rewards_period} a cada {periodLabel}</strong><p>Indicações acima do teto continuam registradas, mas não geram nova recompensa naquele período.</p></div>
            <div className="mission-card"><strong>Sem desconto para entrar</strong><p>O convidado segue as condições normais do plano. Promoções não são criadas automaticamente pelo link.</p></div>
            <div className="mission-card"><strong>Aplicação manual</strong><p>{family ? "O crédito" : "O bônus"} fica disponível para conferência; não altera cobrança nem folha automaticamente.</p></div>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Acompanhamento das indicações</h2>
            <p>{family ? "Para preservar a privacidade, você acompanha o andamento sem ver os dados pessoais da família indicada." : "Acompanhe as famílias que chegaram pelo seu link."}</p>
          </div>
        </div>
        {activity.length ? (
          <div className="form-stack">
            {activity.slice(0, 10).map((item, index) => (
              <article className="mission-card" key={item.referral_id}>
                <div className="flex space-between gap-8 wrap align-center">
                  <strong>{family ? `Indicação ${activity.length - index}` : item.child_name || item.guardian_name || `Indicação ${index + 1}`}</strong>
                  <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
                </div>
                <p className="muted mb-0">Registrada em {shortDate(item.created_at)}{item.confirmed_at ? ` · pagamento confirmado em ${shortDate(item.confirmed_at)}` : ""}</p>
              </article>
            ))}
          </div>
        ) : <p className="muted">Seu link ainda não registrou indicações.</p>}
      </section>

      <section className="panel">
        <h3 className="mt-0">Código da sua indicação</h3>
        <p className="muted mb-0"><code>{code}</code> · {summary.public_rules || rule.public_rules || "A elegibilidade depende de matrícula, pagamento, permanência e limite do período."}</p>
      </section>
    </>
  );
}
