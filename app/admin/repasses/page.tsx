import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { generateTeacherPayouts, reviewTeacherPayout, updatePlanTeacherCompensation } from "./actions";

function money(value: unknown) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function monthLabel(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${String(value).slice(0, 10)}T12:00:00Z`));
}

function modelLabel(value?: string | null) {
  if (value === "fixed_monthly") return "Valor fixo mensal";
  if (value === "percent_plan") return "Percentual do plano";
  if (value === "per_meeting") return "Por encontro realizado";
  return "Sem remuneração configurada";
}

function statusLabel(value: string) {
  if (value === "review") return "Em revisão";
  if (value === "approved") return "Aprovado";
  if (value === "paid") return "Pago";
  if (value === "blocked") return "Bloqueado";
  if (value === "cancelled") return "Cancelado";
  return "Pendente";
}

function statusTone(value: string): "green" | "blue" | "yellow" | "pink" | "neutral" {
  if (value === "paid") return "green";
  if (value === "approved") return "blue";
  if (value === "review" || value === "pending") return "yellow";
  if (value === "blocked") return "pink";
  return "neutral";
}

function planRule(plan: any) {
  if (plan.teacher_compensation_model === "fixed_monthly") return `${money(plan.teacher_compensation_fixed_amount)} por mês`;
  if (plan.teacher_compensation_model === "percent_plan") return `${Number(plan.teacher_compensation_percent || 0).toLocaleString("pt-BR")}% do valor pago`;
  if (plan.teacher_compensation_model === "per_meeting") {
    const limit = plan.teacher_compensation_meeting_limit ?? plan.meetings_per_month;
    return `${money(plan.teacher_compensation_per_meeting)} por encontro · até ${limit} no ciclo`;
  }
  return "Ainda não configurado";
}

export default async function AdminTeacherPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; status?: string; professor?: string; plano?: string; erro?: string; sucesso?: string }>;
}) {
  const query = await searchParams;
  await requireRole("admin");
  const supabase = await createClient();
  const currentMonth = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "America/Bahia" }).format(new Date()).slice(0, 7);
  const referenceMonth = /^\d{4}-\d{2}$/.test(query.mes || "") ? String(query.mes) : currentMonth;

  const [{ data: plans }, { data: teachers }, { data: payouts }] = await Promise.all([
    supabase.from("plans").select("id,name,monthly_price,meetings_per_month,delivery_mode,active,archived_at,teacher_compensation_model,teacher_compensation_fixed_amount,teacher_compensation_percent,teacher_compensation_per_meeting,teacher_compensation_meeting_limit").is("deleted_at", null).order("sort_order").order("name"),
    supabase.from("teachers").select("id,active,profiles(full_name,preferred_name)").order("created_at"),
    supabase.from("teacher_payouts").select("id,teacher_id,student_id,guardian_id,subscription_id,plan_id,family_payment_id,reference_month,family_amount,compensation_model,base_value,expected_meetings,completed_meetings,billable_meetings,calculated_amount,adjustment_amount,final_amount,delivery_mode,status,calculation_details,admin_note,adjustment_reason,approved_at,paid_at,blocked_at,cancelled_at,created_at,updated_at").gte("reference_month", `${referenceMonth}-01`).lt("reference_month", `${referenceMonth}-32`).order("created_at", { ascending: false }).limit(300),
  ]);

  const filtered = (payouts ?? []).filter((item: any) => {
    if (query.status && query.status !== "all" && item.status !== query.status) return false;
    if (query.professor && item.teacher_id !== query.professor) return false;
    if (query.plano && item.plan_id !== query.plano) return false;
    return true;
  });
  const studentIds = [...new Set(filtered.map((item: any) => item.student_id).filter(Boolean))];
  const guardianIds = [...new Set(filtered.map((item: any) => item.guardian_id).filter(Boolean))];
  const [{ data: students }, { data: guardians }] = await Promise.all([
    studentIds.length ? supabase.from("students").select("id,full_name,preferred_name").in("id", studentIds) : Promise.resolve({ data: [] as any[] }),
    guardianIds.length ? supabase.from("guardians").select("id,profiles(full_name,preferred_name)").in("id", guardianIds) : Promise.resolve({ data: [] as any[] }),
  ]);

  const teacherName = new Map((teachers ?? []).map((item: any) => [item.id, item.profiles?.preferred_name || item.profiles?.full_name || "Professor"]));
  const studentName = new Map((students ?? []).map((item: any) => [item.id, item.preferred_name || item.full_name || "Aluno"]));
  const guardianName = new Map((guardians ?? []).map((item: any) => [item.id, item.profiles?.preferred_name || item.profiles?.full_name || "Família"]));
  const planById = new Map((plans ?? []).map((item: any) => [item.id, item]));

  const reviewCount = (payouts ?? []).filter((item: any) => ["pending", "review"].includes(item.status)).length;
  const blockedCount = (payouts ?? []).filter((item: any) => item.status === "blocked").length;
  const approvedAmount = (payouts ?? []).filter((item: any) => item.status === "approved").reduce((sum: number, item: any) => sum + Number(item.final_amount || 0), 0);
  const paidAmount = (payouts ?? []).filter((item: any) => item.status === "paid").reduce((sum: number, item: any) => sum + Number(item.final_amount || 0), 0);

  return <>
    <PageHeader eyebrow="Admin • Operação" title="Repasses de Professores" description="Calcule, revise, aprove e registre pagamentos de professores sem misturar remuneração com campanhas de indicação." />
    {query.erro && <div className="form-message form-error">{query.erro}</div>}
    {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

    <section className="panel family-highlight">
      <strong>Regra de segurança financeira</strong>
      <p className="mb-0">O repasse só entra em revisão quando existe mensalidade da família marcada como paga e encontro/aula/revisão concluído no período. Nenhum valor é enviado ao banco automaticamente; a Administração ainda precisa aprovar e depois marcar como pago.</p>
    </section>

    <div className="stats-grid mt-16">
      <StatCard value={reviewCount} label="Aguardando revisão" />
      <StatCard value={blockedCount} label="Bloqueados" />
      <StatCard value={money(approvedAmount)} label="Aprovado no mês" />
      <StatCard value={money(paidAmount)} label="Pago no mês" />
    </div>

    <section className="panel">
      <div className="panel-head"><div><h2>Fechar / recalcular competência</h2><p>O cálculo é idempotente: repasses já aprovados, pagos ou cancelados são preservados.</p></div></div>
      <form action={generateTeacherPayouts} className="flex gap-8 wrap">
        <div className="field"><label>Competência</label><input className="input" type="month" name="referenceMonth" defaultValue={referenceMonth} required /></div>
        <div className="field field-actions"><label>&nbsp;</label><button className="button button-primary" type="submit">Gerar / recalcular repasses</button></div>
      </form>
    </section>

    <section className="panel">
      <div className="panel-head"><div><h2>Remuneração por plano</h2><p>A regra comercial do professor fica vinculada ao plano e é copiada para a matrícula como snapshot. Mudanças posteriores não reescrevem repasses já fechados.</p></div></div>
      <div className="plan-management-grid">
        {(plans ?? []).map((plan: any) => <article className="plan-admin-card" key={plan.id}>
          <div className="flex space-between gap-8 wrap"><Badge tone={plan.active && !plan.archived_at ? "green" : "neutral"}>{plan.active && !plan.archived_at ? "Plano ativo" : "Inativo"}</Badge><Badge tone={plan.teacher_compensation_model === "none" ? "neutral" : "blue"}>{modelLabel(plan.teacher_compensation_model)}</Badge></div>
          <h3>{plan.name}</h3><p>{money(plan.monthly_price)} / mês · {plan.meetings_per_month || 0} encontros exibidos</p>
          <div className="notice"><strong>{planRule(plan)}</strong></div>
          <details className="plan-editor"><summary>Configurar remuneração</summary>
            <form action={updatePlanTeacherCompensation} className="form-stack plan-form">
              <input type="hidden" name="planId" value={plan.id} />
              <div className="field"><label>Modelo</label><select className="select" name="model" defaultValue={plan.teacher_compensation_model || "none"}><option value="none">Sem remuneração automática</option><option value="fixed_monthly">Valor fixo mensal</option><option value="percent_plan">Percentual do plano</option><option value="per_meeting">Por encontro realizado</option></select></div>
              <div className="form-row"><div className="field"><label>Valor fixo mensal</label><input className="input" type="number" min="0.01" step="0.01" name="fixedAmount" defaultValue={plan.teacher_compensation_fixed_amount ?? ""} placeholder="Ex.: 180,00" /></div><div className="field"><label>Percentual do valor pago</label><input className="input" type="number" min="0.01" max="100" step="0.01" name="percent" defaultValue={plan.teacher_compensation_percent ?? ""} placeholder="Ex.: 40" /></div></div>
              <div className="form-row"><div className="field"><label>Valor por encontro</label><input className="input" type="number" min="0.01" step="0.01" name="perMeeting" defaultValue={plan.teacher_compensation_per_meeting ?? ""} placeholder="Ex.: 45,00" /></div><div className="field"><label>Limite remunerável no ciclo</label><input className="input" type="number" min="0" max="1000" name="meetingLimit" defaultValue={plan.teacher_compensation_meeting_limit ?? ""} placeholder={`Padrão do plano: ${plan.meetings_per_month || 0}`} /></div></div>
              <small className="muted">Preencha somente os campos do modelo escolhido. O sistema impede percentual acima de 100% e valores que possam superar a mensalidade do plano.</small>
              <button className="button button-primary button-small" type="submit">Salvar regra do plano</button>
            </form>
          </details>
        </article>)}
      </div>
    </section>

    <section className="panel">
      <div className="panel-head"><div><h2>Repasses de {monthLabel(`${referenceMonth}-01`)}</h2><p>Filtre e confira cada cálculo antes de aprovar.</p></div></div>
      <form method="get" className="form-row">
        <div className="field"><label>Competência</label><input className="input" type="month" name="mes" defaultValue={referenceMonth} /></div>
        <div className="field"><label>Status</label><select className="select" name="status" defaultValue={query.status || "all"}><option value="all">Todos</option><option value="review">Em revisão</option><option value="blocked">Bloqueado</option><option value="approved">Aprovado</option><option value="paid">Pago</option><option value="cancelled">Cancelado</option></select></div>
        <div className="field"><label>Professor</label><select className="select" name="professor" defaultValue={query.professor || ""}><option value="">Todos</option>{(teachers ?? []).map((item: any) => <option value={item.id} key={item.id}>{teacherName.get(item.id)}</option>)}</select></div>
        <div className="field"><label>Plano</label><select className="select" name="plano" defaultValue={query.plano || ""}><option value="">Todos</option>{(plans ?? []).map((item: any) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div>
        <div className="field field-actions"><label>&nbsp;</label><button className="button button-secondary" type="submit">Filtrar</button></div>
      </form>

      {filtered.length ? <div className="form-stack mt-16">{filtered.map((item: any) => {
        const plan: any = planById.get(item.plan_id);
        const canReview = ["pending", "blocked", "review"].includes(item.status);
        const canApprove = item.status === "review";
        const canPay = item.status === "approved";
        const canBlock = ["pending", "review", "blocked"].includes(item.status);
        const canCancel = ["pending", "review", "blocked"].includes(item.status);
        return <article className="mission-card" key={item.id}>
          <div className="flex space-between gap-8 wrap"><div><strong>{teacherName.get(item.teacher_id) || "Professor"}</strong><p>{studentName.get(item.student_id) || "Aluno"} · {guardianName.get(item.guardian_id) || "Família"} · {plan?.name || "Plano"}</p></div><Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge></div>
          <div className="record-meta-grid mt-12">
            <span><small>Família pagou</small><strong>{money(item.family_amount)}</strong></span>
            <span><small>Modelo</small><strong>{modelLabel(item.compensation_model)}</strong></span>
            <span><small>Encontros</small><strong>{item.completed_meetings}/{item.expected_meetings || "—"}</strong></span>
            <span><small>Remuneráveis</small><strong>{item.billable_meetings}</strong></span>
            <span><small>Cálculo base</small><strong>{money(item.calculated_amount)}</strong></span>
            <span><small>Ajuste</small><strong>{money(item.adjustment_amount)}</strong></span>
            <span><small>Valor final</small><strong>{money(item.final_amount)}</strong></span>
            <span><small>Modalidade</small><strong>{item.delivery_mode || "—"}</strong></span>
          </div>
          <p className="muted text-small">Base usada: {item.compensation_model === "percent_plan" ? `${Number(item.base_value || 0).toLocaleString("pt-BR")}%` : money(item.base_value)}. Apenas eventos marcados como concluídos entram no cálculo; cancelados não contam.</p>
          {item.adjustment_reason && <div className="notice"><strong>Ajuste manual:</strong> {item.adjustment_reason}</div>}
          {item.admin_note && <p className="muted">Observação: {item.admin_note}</p>}
          {item.status !== "paid" && item.status !== "cancelled" ? <form action={reviewTeacherPayout} className="form-stack compact-form mt-16">
            <input type="hidden" name="payoutId" value={item.id} />
            <div className="form-row"><div className="field"><label>Ajuste manual</label><input className="input" type="number" step="0.01" name="adjustmentAmount" defaultValue={Number(item.adjustment_amount || 0)} /></div><div className="field"><label>Justificativa do ajuste</label><input className="input" name="adjustmentReason" defaultValue={item.adjustment_reason || ""} placeholder="Obrigatória quando o ajuste não for zero" /></div></div>
            <div className="field"><label>Observação administrativa</label><input className="input" name="adminNote" defaultValue={item.admin_note || ""} placeholder="Opcional" /></div>
            <div className="flex gap-8 wrap">
              {canReview && <button className="button button-secondary button-small" type="submit" name="decision" value="review">Enviar para revisão</button>}
              {canApprove && <button className="button button-primary button-small" type="submit" name="decision" value="approve">Aprovar repasse</button>}
              {canPay && <button className="button button-primary button-small" type="submit" name="decision" value="paid">Marcar como pago</button>}
              {canBlock && <button className="button button-ghost button-small" type="submit" name="decision" value="block">Bloquear</button>}
              {canCancel && <button className="button button-danger button-small" type="submit" name="decision" value="cancel">Cancelar</button>}
            </div>
          </form> : null}
        </article>;
      })}</div> : <EmptyState title="Nenhum repasse nesta seleção" description="Configure a remuneração dos planos e gere a competência depois que houver mensalidade paga e trabalho concluído." />}
    </section>
  </>;
}
