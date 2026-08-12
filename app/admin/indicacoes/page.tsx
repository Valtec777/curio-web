import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { setReferralStatus } from "@/app/admin/indicacoes/actions";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bahia" }).format(new Date(value));
}

function money(value?: number | string | null) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function statusTone(status: string): "green" | "yellow" | "pink" | "blue" | "neutral" {
  if (status === "rewarded") return "green";
  if (status === "qualified") return "blue";
  if (status === "converted") return "yellow";
  if (status === "rejected") return "pink";
  return "neutral";
}

function nextStatus(status: string): { value: "converted" | "qualified" | "rewarded"; label: string } | null {
  if (status === "new") return { value: "converted", label: "Marcar conversão" };
  if (status === "converted") return { value: "qualified", label: "Qualificar após retenção" };
  if (status === "qualified") return { value: "rewarded", label: "Registrar crédito" };
  return null;
}

export default async function AdminReferralsPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  await requireRole("admin");
  const query = await searchParams;
  const supabase = await createClient();
  const [{ data: leads }, { data: codes }, { data: rules }] = await Promise.all([
    supabase.from("referral_leads").select("id,referral_code_id,referred_email,status,reward_value,created_at,converted_at,qualified_at,rewarded_at").order("created_at", { ascending: false }).limit(120),
    supabase.from("referral_codes").select("id,owner_user_id,owner_role,code,active"),
    supabase.from("referral_program_rules").select("owner_role,reward_value,qualification_days,max_rewards_period,period_days,active"),
  ]);

  const ownerIds = Array.from(new Set((codes ?? []).map((code: any) => code.owner_user_id)));
  const { data: owners } = ownerIds.length
    ? await supabase.from("profiles").select("id,full_name,preferred_name").in("id", ownerIds)
    : { data: [] as any[] };
  const codeById = new Map((codes ?? []).map((code: any) => [code.id, code]));
  const ownerById = new Map((owners ?? []).map((owner: any) => [owner.id, owner]));
  const totalRewarded = (leads ?? []).filter((lead: any) => lead.status === "rewarded").reduce((sum: number, lead: any) => sum + Number(lead.reward_value || 0), 0);

  return (
    <>
      <PageHeader eyebrow="Operação CURIÓ" title="Indicações" description="Acompanhe origem, conversão, retenção e recompensas sem aplicar descontos automaticamente." />
      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <div className="stats-grid">
        <StatCard value={(leads ?? []).length} label="Indicações registradas" />
        <StatCard value={(leads ?? []).filter((lead: any) => lead.status === "converted").length} label="Convertidas aguardando retenção" />
        <StatCard value={(leads ?? []).filter((lead: any) => lead.status === "rewarded").length} label="Recompensadas" />
        <StatCard value={money(totalRewarded)} label="Créditos registrados" />
      </div>

      <section className="panel">
        <div className="panel-head"><div><h2>Regras ativas</h2><p>O banco impede recompensa precoce e bloqueia ultrapassar o teto do período.</p></div></div>
        <div className="grid-2">
          {(rules ?? []).map((rule: any) => (
            <article className="mission-card" key={rule.owner_role}>
              <Badge tone={rule.active ? "green" : "neutral"}>{rule.owner_role === "guardian" ? "Famílias" : "Professores"}</Badge>
              <h3>{money(rule.reward_value)} por indicação elegível</h3>
              <p>{rule.qualification_days} dias mínimos após conversão • teto de {rule.max_rewards_period} recompensa(s) a cada {rule.period_days >= 365 ? "12 meses" : `${rule.period_days} dias`}.</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><div><h2>Fila de indicações</h2><p>O e-mail indicado fica visível apenas na operação administrativa.</p></div></div>
        {leads?.length ? (
          <div className="form-stack">
            {leads.map((lead: any) => {
              const code: any = codeById.get(lead.referral_code_id);
              const owner: any = code ? ownerById.get(code.owner_user_id) : null;
              const next = nextStatus(lead.status);
              return (
                <article className="mission-card" key={lead.id}>
                  <div className="flex space-between gap-8 wrap">
                    <div>
                      <div className="flex gap-8 wrap align-center"><Badge tone={statusTone(lead.status)}>{lead.status}</Badge><Badge tone="neutral">{code?.owner_role === "teacher" ? "Professor" : "Família"}</Badge></div>
                      <h3>{lead.referred_email}</h3>
                      <p>Indicado por {owner?.preferred_name || owner?.full_name || "Perfil não encontrado"} • código {code?.code || "—"}</p>
                    </div>
                    <strong>{lead.status === "rewarded" ? money(lead.reward_value) : "Sem crédito aplicado"}</strong>
                  </div>
                  <small className="muted">Recebido: {dt(lead.created_at)} • Conversão: {dt(lead.converted_at)} • Qualificação: {dt(lead.qualified_at)} • Recompensa: {dt(lead.rewarded_at)}</small>
                  {lead.status !== "rewarded" && lead.status !== "rejected" && (
                    <div className="flex gap-8 wrap" style={{ marginTop: 12 }}>
                      {next && (
                        <form action={setReferralStatus}>
                          <input type="hidden" name="id" value={lead.id} />
                          <input type="hidden" name="status" value={next.value} />
                          <button className="button button-secondary button-small" type="submit">{next.label}</button>
                        </form>
                      )}
                      <form action={setReferralStatus}>
                        <input type="hidden" name="id" value={lead.id} />
                        <input type="hidden" name="status" value="rejected" />
                        <button className="button button-ghost button-small" type="submit">Rejeitar</button>
                      </form>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : <EmptyState title="Nenhuma indicação ainda" description="Novos interesses enviados pelos links de família e professor aparecerão aqui." />}
      </section>
    </>
  );
}
