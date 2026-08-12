import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { getFamilyPortal } from "@/lib/family";
import { planResourceLabel, planUsageStateLabel, planUsageTone } from "@/lib/plan-usage";

function money(value: unknown) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function date(value?: string | null) {
  if (!value) return "—";
  const raw = String(value).slice(0, 10);
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(`${raw}T12:00:00Z`));
}

function intervalLabel(value?: string | null) {
  if (value === "annual") return "Anual";
  if (value === "quarterly") return "Trimestral";
  return "Mensal";
}

export default async function FamilyPlanPage({ searchParams }: { searchParams: Promise<{ aluno?: string }> }) {
  const query = await searchParams;
  const { guardian, selectedChild, supabase } = await getFamilyPortal(query.aluno || null);
  if (!guardian?.active || !selectedChild) return <EmptyState title="Plano indisponível" description="A administração precisa concluir o vínculo da família e da criança." />;

  const [{ data: subscriptions }, { data: usageRows }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id,status,agreed_monthly_price,starts_at,ends_at,plans(name,description,monthly_price,billing_interval,features,meetings_per_month,delivery_mode)")
      .eq("guardian_id", guardian.id)
      .eq("student_id", selectedChild.student_id)
      .order("created_at", { ascending: false }),
    supabase.rpc("plan_consumption_for_student", { p_student_id: selectedChild.student_id }),
  ]);

  const current = subscriptions?.find((sub: any) => ["active", "pending", "paused"].includes(sub.status)) || subscriptions?.[0] || null;
  const rows = usageRows ?? [];
  const first: any = rows[0];

  return (
    <>
      <PageHeader eyebrow="Ninho da Família" title={`Plano de ${selectedChild.student_name}`} description="Plano contratado, ciclo atual e recursos disponíveis no acompanhamento." />

      {current ? <section className="panel family-highlight">
        <div className="flex space-between gap-8 wrap">
          <div>
            <Badge tone={current.status === "active" ? "green" : current.status === "paused" ? "pink" : current.status === "pending" ? "yellow" : "neutral"}>
              {current.status === "active" ? "Ativo" : current.status === "paused" ? "Pausado" : current.status === "pending" ? "Pagamento pendente" : current.status}
            </Badge>
            <h2>{current.plans?.name || "Plano CURIÓ"}</h2>
            <p>{current.plans?.description || "Acompanhamento escolar CURIÓ."}</p>
          </div>
          <div><strong style={{ fontSize: 24 }}>{money(current.agreed_monthly_price ?? current.plans?.monthly_price)}</strong><div className="muted text-small">{intervalLabel(current.plans?.billing_interval)}</div></div>
        </div>

        <div className="grid-3 mt-16">
          <article className="family-summary-card"><span>Ciclo atual</span><h3>{first ? `${date(first.cycle_start)} → ${date(first.cycle_end)}` : `${date(current.starts_at)} → ${current.ends_at ? date(current.ends_at) : "em andamento"}`}</h3><p>Período usado para calcular os recursos do plano.</p></article>
          <article className="family-summary-card"><span>Próxima renovação</span><h3>{first ? date(first.renews_on) : "A confirmar"}</h3><p>Os limites reiniciam quando começa o próximo ciclo.</p></article>
          <article className="family-summary-card"><span>Situação</span><h3>{current.status === "active" ? "Acompanhamento ativo" : current.status === "paused" ? "Temporariamente pausado" : current.status === "pending" ? "Pagamento pendente" : current.status}</h3><p>{current.status === "pending" ? "A confirmação financeira ainda depende da administração." : current.status === "paused" ? "Alguns recursos podem ficar temporariamente indisponíveis." : "Plano em acompanhamento."}</p></article>
        </div>

        {Array.isArray(current.plans?.features) && current.plans.features.length ? <div className="flex gap-8 wrap mt-16">{current.plans.features.map((feature: any, index: number) => <Badge tone="blue" key={`${String(feature)}-${index}`}>{typeof feature === "string" ? feature : feature?.label || feature?.name || "Benefício"}</Badge>)}</div> : null}
      </section> : null}

      <section className="panel">
        <div className="panel-head"><div><h2>Uso do plano neste ciclo</h2><p>Acompanhe o que já foi utilizado e o que ainda está disponível.</p></div></div>
        {rows.length ? <div className="grid-3">{rows.map((row: any) => <article className="family-summary-card" key={row.resource_key}>
          <Badge tone={planUsageTone(row.usage_state)}>{planUsageStateLabel(row.usage_state)}</Badge>
          <h3>{!row.enabled ? "Não incluído" : row.limit_per_cycle == null ? `${row.used_units} utilizado(s)` : `${row.used_units}/${row.limit_per_cycle}`}</h3>
          <p>{planResourceLabel(row.resource_key)}</p>
          {row.enabled && row.limit_per_cycle != null ? <small className="muted">{row.remaining_units > 0 ? `${row.remaining_units} restante(s) neste ciclo` : `Novo ciclo em ${date(row.renews_on)}`}</small> : row.enabled ? <small className="muted">Sem teto definido no plano atual</small> : null}
        </article>)}</div> : <EmptyState title="Consumo ainda não iniciado" description="Os recursos utilizados aparecerão aqui conforme o acompanhamento avançar." />}
      </section>

      {subscriptions && subscriptions.length > 1 ? <section className="panel">
        <div className="panel-head"><div><h2>Histórico de planos</h2><p>Planos anteriores ficam registrados sem apagar o histórico da matrícula.</p></div></div>
        <div className="form-stack">{subscriptions.filter((sub: any) => sub.id !== current?.id).map((sub: any) => <article className="family-upload-card" key={sub.id}><div className="flex space-between gap-8 wrap"><div><Badge tone="neutral">{sub.status}</Badge><strong>{sub.plans?.name || "Plano CURIÓ"}</strong></div><strong>{money(sub.agreed_monthly_price ?? sub.plans?.monthly_price)}</strong></div><small className="muted">{date(sub.starts_at)} → {sub.ends_at ? date(sub.ends_at) : "—"}</small></article>)}</div>
      </section> : null}

      {!subscriptions?.length ? <EmptyState title="Nenhum plano vinculado" description={`Quando o plano de ${selectedChild.student_name} for configurado, ele aparecerá aqui.`} /> : null}
    </>
  );
}
