import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { planResourceLabel, planUsageStateLabel, planUsageTone } from "@/lib/plan-usage";
import { createCommercialPlan, manageCommercialPlan, updateCommercialPlan } from "../actions";
import { updatePlanEntitlements } from "./actions";

const resourceOrder = ["meetings", "missions", "assessments", "notebooks", "materials", "courses"];

function money(value: unknown) {
  return `R$ ${Number(value || 0).toFixed(2).replace(".", ",")}`;
}

function date(value?: string | null) {
  if (!value) return "—";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : String(value);
}

export default async function AdminPlansPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  await requireRole("admin");
  const supabase = await createClient();

  const [{ data: plans }, { data: usageRows }, { count: activeSubscriptions }] = await Promise.all([
    supabase
      .from("plans")
      .select("id,name,description,monthly_price,currency,features,active,billing_interval,meetings_per_month,delivery_mode,visible_on_landing,available_for_enrollment,badge,sort_order,archived_at,deleted_at,plan_entitlements(resource_key,limit_per_cycle,enabled,hard_limit,warning_percent)")
      .is("deleted_at", null)
      .order("sort_order")
      .order("created_at"),
    supabase.rpc("admin_plan_consumption"),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).in("status", ["active", "pending"]),
  ]);

  const studentIds = [...new Set((usageRows ?? []).map((row: any) => row.student_id))];
  const { data: students } = studentIds.length
    ? await supabase.from("students").select("id,preferred_name,full_name").in("id", studentIds)
    : { data: [] as any[] };
  const studentName = new Map((students ?? []).map((student: any) => [student.id, student.preferred_name || student.full_name || "Aluno"]));

  const usageByStudent = new Map<string, any[]>();
  for (const row of usageRows ?? []) {
    usageByStudent.set(row.student_id, [...(usageByStudent.get(row.student_id) || []), row]);
  }

  const activeCount = (plans ?? []).filter((plan: any) => plan.active && !plan.archived_at).length;
  const configuredLimits = (plans ?? []).reduce((count: number, plan: any) => count + (plan.plan_entitlements || []).filter((item: any) => item.limit_per_cycle !== null || !item.enabled).length, 0);

  return <>
    <PageHeader eyebrow="Admin • Operação" title="Planos e consumo" description="Configure o que cada plano inclui e acompanhe o uso do ciclo sem depender da memória do professor." />
    {query.erro && <div className="form-message form-error">{query.erro}</div>}
    {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

    <div className="stats-grid">
      <StatCard value={plans?.length ?? 0} label="Planos cadastrados" />
      <StatCard value={activeCount} label="Planos ativos" />
      <StatCard value={activeSubscriptions ?? 0} label="Matrículas em acompanhamento" />
      <StatCard value={configuredLimits} label="Limites configurados" />
    </div>

    <section className="panel">
      <div className="panel-head"><div><h2>Novo plano</h2><p>O plano nasce com o limite de encontros informado; os demais recursos começam sem limite definido e podem ser configurados logo abaixo.</p></div></div>
      <details className="plan-editor"><summary className="button button-primary button-small">Criar novo plano</summary>
        <form action={createCommercialPlan} className="form-stack plan-form">
          <div className="form-row"><div className="field"><label>Nome *</label><input className="input" name="name" required /></div><div className="field"><label>Preço mensal *</label><input className="input" name="monthlyPrice" type="number" min="0" step="0.01" required /></div></div>
          <div className="field"><label>Descrição *</label><textarea className="textarea" name="description" required /></div>
          <div className="form-row"><div className="field"><label>Encontros pedagógicos por ciclo</label><input className="input" name="meetingsPerMonth" type="number" min="0" defaultValue="4" /></div><div className="field"><label>Modalidade</label><select className="select" name="deliveryMode" defaultValue="online"><option value="online">Online</option><option value="hybrid">Híbrido</option><option value="presential">Presencial</option></select></div></div>
          <div className="form-row"><div className="field"><label>Selo</label><input className="input" name="badge" placeholder="Piloto, Recomendado..." /></div><div className="field"><label>Ordem</label><input className="input" name="sortOrder" type="number" defaultValue="60" /></div></div>
          <div className="field"><label>Benefícios comerciais</label><textarea className="textarea" name="features" placeholder="Um por linha" /></div>
          <div className="plan-check-row"><label><input type="checkbox" name="active" /> Ativo</label><label><input type="checkbox" name="visibleOnLanding" /> Visível no site</label><label><input type="checkbox" name="availableForEnrollment" defaultChecked /> Disponível para matrícula</label></div>
          <button className="button button-primary" type="submit">Criar plano</button>
        </form>
      </details>
    </section>

    <section className="panel">
      <div className="panel-head"><div><h2>Regras dos planos</h2><p>Em branco significa sem limite definido. Zero significa que o recurso não está incluído. Um número positivo vira limite real do ciclo.</p></div></div>
      <div className="plan-management-grid">{(plans ?? []).map((plan: any) => {
        const entitlements = new Map((plan.plan_entitlements || []).map((item: any) => [item.resource_key, item]));
        const lifecycle = plan.archived_at ? "Arquivado" : plan.active ? "Ativo" : "Rascunho";
        return <article className={`plan-admin-card ${plan.badge === "Recomendado" ? "plan-featured" : ""}`} key={plan.id}>
          <div className="flex gap-8 wrap"><Badge tone={plan.archived_at ? "neutral" : plan.active ? "green" : "yellow"}>{lifecycle}</Badge>{plan.badge ? <Badge tone="blue">{plan.badge}</Badge> : null}</div>
          <h3>{plan.name}</h3><p>{plan.description}</p>
          <div className="plan-price-line"><strong>{money(plan.monthly_price)}</strong><span>/ mês</span></div>

          <div className="form-stack mt-12">
            {resourceOrder.map((key) => {
              const item: any = entitlements.get(key);
              const text = item && !item.enabled ? "Não incluído" : item?.limit_per_cycle == null ? "Sem limite definido" : `${item.limit_per_cycle} por ciclo`;
              return <div className="flex space-between gap-8 wrap" key={key}><span>{planResourceLabel(key)}</span><strong>{text}</strong></div>;
            })}
          </div>

          <details className="plan-editor mt-16"><summary>Editar limites</summary>
            <form action={updatePlanEntitlements} className="form-stack plan-form">
              <input type="hidden" name="planId" value={plan.id} />
              {resourceOrder.map((key) => {
                const item: any = entitlements.get(key);
                const defaultValue = item && !item.enabled ? 0 : item?.limit_per_cycle ?? "";
                return <div className="field" key={key}><label>{planResourceLabel(key)}</label><input className="input" type="number" min="0" max="1000" name={`${key}Limit`} defaultValue={defaultValue} placeholder="Sem limite definido" /></div>;
              })}
              <button className="button button-primary button-small" type="submit">Salvar limites</button>
            </form>
          </details>

          <details className="plan-editor"><summary>Editar informações comerciais</summary>
            <form action={updateCommercialPlan} className="form-stack plan-form">
              <input type="hidden" name="planId" value={plan.id} />
              <div className="field"><label>Nome</label><input className="input" name="name" defaultValue={plan.name} required /></div>
              <div className="field"><label>Descrição</label><textarea className="textarea" name="description" defaultValue={plan.description || ""} required /></div>
              <div className="form-row"><div className="field"><label>Preço mensal</label><input className="input" name="monthlyPrice" type="number" step="0.01" defaultValue={Number(plan.monthly_price || 0)} required /></div><div className="field"><label>Encontros/mês</label><input className="input" name="meetingsPerMonth" type="number" min="0" defaultValue={plan.meetings_per_month || 0} /></div></div>
              <div className="form-row"><div className="field"><label>Modalidade</label><select className="select" name="deliveryMode" defaultValue={plan.delivery_mode || "online"}><option value="online">Online</option><option value="hybrid">Híbrido</option><option value="presential">Presencial</option></select></div><div className="field"><label>Selo</label><input className="input" name="badge" defaultValue={plan.badge || ""} /></div></div>
              <div className="field"><label>Benefícios</label><textarea className="textarea" name="features" defaultValue={(plan.features || []).join("\n")} /></div><input type="hidden" name="sortOrder" value={plan.sort_order || 0} />
              <div className="plan-check-row"><label><input type="checkbox" name="active" defaultChecked={plan.active} /> Ativo</label><label><input type="checkbox" name="visibleOnLanding" defaultChecked={plan.visible_on_landing} /> Visível no site</label><label><input type="checkbox" name="availableForEnrollment" defaultChecked={plan.available_for_enrollment} /> Matrícula</label></div>
              <button className="button button-secondary button-small" type="submit">Salvar informações</button>
            </form>
          </details>

          <div className="plan-admin-actions">
            <form action={manageCommercialPlan}><input type="hidden" name="planId" value={plan.id} /><input type="hidden" name="action" value={plan.active && !plan.archived_at ? "draft" : "activate"} /><button className="button button-secondary button-small" type="submit">{plan.active && !plan.archived_at ? "Virar rascunho" : "Ativar"}</button></form>
            {!plan.archived_at ? <form action={manageCommercialPlan}><input type="hidden" name="planId" value={plan.id} /><input type="hidden" name="action" value="archive" /><button className="button button-ghost button-small" type="submit">Arquivar</button></form> : null}
            <form action={manageCommercialPlan}><input type="hidden" name="planId" value={plan.id} /><input type="hidden" name="action" value="delete" /><button className="button button-danger button-small" type="submit">Excluir</button></form>
          </div>
        </article>;
      })}</div>
      {!plans?.length ? <EmptyState title="Nenhum plano cadastrado" description="Crie o primeiro plano comercial do CURIÓ." /> : null}
    </section>

    <section className="panel">
      <div className="panel-head"><div><h2>Consumo do ciclo atual</h2><p>Visão administrativa dos direitos e do uso real de cada matrícula. Pagamento pendente aparece como situação, mas não inventa bloqueio financeiro automático.</p></div></div>
      {usageByStudent.size ? <div className="form-stack">{[...usageByStudent.entries()].map(([studentId, rows]) => {
        const first = rows[0];
        return <article className="mission-card" key={studentId}>
          <div className="flex space-between gap-8 wrap"><div><strong>{studentName.get(studentId) || "Aluno"}</strong><p>{first.plan_name} · ciclo {date(first.cycle_start)} a {date(first.cycle_end)}</p></div><div className="flex gap-8 wrap"><Badge tone={first.subscription_status === "active" ? "green" : first.subscription_status === "paused" ? "pink" : "yellow"}>{first.subscription_status === "active" ? "Ativa" : first.subscription_status === "paused" ? "Pausada" : "Pagamento pendente"}</Badge><Badge tone="blue">Renova em {date(first.renews_on)}</Badge></div></div>
          <div className="grid-3 mt-12">{rows.map((row: any) => <div className="family-summary-card" key={row.resource_key}><Badge tone={planUsageTone(row.usage_state)}>{planUsageStateLabel(row.usage_state)}</Badge><h3>{row.enabled ? row.limit_per_cycle == null ? `${row.used_units}` : `${row.used_units}/${row.limit_per_cycle}` : "—"}</h3><p>{planResourceLabel(row.resource_key)}</p></div>)}</div>
        </article>;
      })}</div> : <EmptyState title="Sem consumo registrado" description="Quando houver matrículas com plano e uso de recursos, elas aparecerão aqui." />}
    </section>
  </>;
}
