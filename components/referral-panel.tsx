import { CopyReferralLink } from "@/components/copy-referral-link";

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function ReferralPanel({
  role,
  code,
  url,
  rule,
}: {
  role: "guardian" | "teacher";
  code?: string | null;
  url?: string | null;
  rule?: {
    reward_value?: number | string | null;
    qualification_days?: number | null;
    max_rewards_period?: number | null;
    period_days?: number | null;
    active?: boolean | null;
  } | null;
}) {
  const family = role === "guardian";
  const reward = Number(rule?.reward_value || (family ? 30 : 40));
  const qualificationDays = rule?.qualification_days ?? 30;
  const maxRewards = rule?.max_rewards_period ?? (family ? 3 : 5);
  const periodDays = rule?.period_days ?? (family ? 365 : 30);
  const periodLabel = periodDays >= 365 ? "12 meses" : periodDays === 30 ? "30 dias" : `${periodDays} dias`;

  if (!code || !url || rule?.active === false) {
    return (
      <section className="panel">
        <h2 className="mt-0">Seu link de indicação</h2>
        <p className="muted">O programa ainda não está disponível para este perfil. Se o acesso acabou de ser criado, a equipe pode revisar a configuração.</p>
      </section>
    );
  }

  return (
    <>
      <section className="panel family-highlight">
        <div className="eyebrow">Indique o CURIÓ</div>
        <h2>{family ? "Compartilhe com outra família" : "Indique para famílias que podem se beneficiar"}</h2>
        <p>
          Seu link identifica a origem da indicação. A recompensa só é liberada quando a nova matrícula permanece ativa pelo período mínimo — sem desconto recorrente automático que comprometa o acompanhamento.
        </p>
        <CopyReferralLink url={url} />
      </section>

      <div className="grid-2">
        <section className="panel">
          <h2 className="mt-0">Como funciona</h2>
          <ol className="referral-policy">
            <li>Você envia seu link individual.</li>
            <li>A família interessada preenche o formulário pelo link.</li>
            <li>A equipe confirma a matrícula e registra a conversão.</li>
            <li>Depois de {qualificationDays} dias de permanência ativa, a indicação pode ser qualificada.</li>
            <li>Após validação administrativa, o crédito é registrado: {money(reward)} por indicação elegível.</li>
          </ol>
        </section>

        <section className="panel">
          <h2 className="mt-0">Limites para manter o programa saudável</h2>
          <div className="form-stack">
            <div className="mission-card"><strong>{money(reward)}</strong><p>Crédito máximo por indicação válida.</p></div>
            <div className="mission-card"><strong>{maxRewards} recompensa(s) a cada {periodLabel}</strong><p>Depois do teto, novas indicações podem ser registradas, mas não geram crédito naquele período.</p></div>
            <div className="mission-card"><strong>Sem acúmulo automático</strong><p>Promoções e condições comerciais são analisadas separadamente; o link não cria desconto recorrente para quem entra.</p></div>
          </div>
        </section>
      </div>

      <section className="panel">
        <h3 className="mt-0">Código da sua indicação</h3>
        <p className="muted mb-0"><code>{code}</code> · A equipe do CURIÓ valida duplicidades, autoindicação, conversão e elegibilidade antes de qualquer crédito.</p>
      </section>
    </>
  );
}
