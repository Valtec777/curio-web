import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { getCurrentTeacher } from "@/lib/teacher";

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
  return "Regra administrativa";
}

function statusLabel(value: string) {
  if (value === "review") return "Em revisão";
  if (value === "approved") return "Aprovado";
  if (value === "paid") return "Pago";
  if (value === "blocked") return "Em conferência";
  if (value === "cancelled") return "Cancelado";
  return "Pendente";
}

function tone(value: string): "green" | "blue" | "yellow" | "pink" | "neutral" {
  if (value === "paid") return "green";
  if (value === "approved") return "blue";
  if (["pending", "review"].includes(value)) return "yellow";
  if (value === "blocked") return "pink";
  return "neutral";
}

export default async function TeacherPayoutsPage() {
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) return <EmptyState title="Perfil incompleto" description="A Administração precisa concluir seu perfil de professor." />;

  const { data: payouts } = await supabase
    .from("teacher_payouts")
    .select("id,student_id,plan_id,reference_month,family_amount,compensation_model,base_value,expected_meetings,completed_meetings,billable_meetings,calculated_amount,adjustment_amount,final_amount,status,delivery_mode,admin_note,approved_at,paid_at,created_at")
    .eq("teacher_id", teacher.id)
    .order("reference_month", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(120);

  const studentIds = [...new Set((payouts ?? []).map((item: any) => item.student_id).filter(Boolean))];
  const planIds = [...new Set((payouts ?? []).map((item: any) => item.plan_id).filter(Boolean))];
  const [{ data: students }, { data: plans }] = await Promise.all([
    studentIds.length ? supabase.from("students").select("id,preferred_name,full_name").in("id", studentIds) : Promise.resolve({ data: [] as any[] }),
    planIds.length ? supabase.from("plans").select("id,name").in("id", planIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const studentName = new Map((students ?? []).map((item: any) => [item.id, item.preferred_name || item.full_name || "Aluno"]));
  const planName = new Map((plans ?? []).map((item: any) => [item.id, item.name || "Plano PLUMARELI"]));

  const reviewing = (payouts ?? []).filter((item: any) => ["pending", "review", "blocked"].includes(item.status)).length;
  const approved = (payouts ?? []).filter((item: any) => item.status === "approved").reduce((sum: number, item: any) => sum + Number(item.final_amount || 0), 0);
  const paid = (payouts ?? []).filter((item: any) => item.status === "paid").reduce((sum: number, item: any) => sum + Number(item.final_amount || 0), 0);

  return <>
    <PageHeader eyebrow="Professor • Conta" title="Meus repasses" description="Acompanhe os valores calculados a partir do plano, da mensalidade confirmada e dos encontros concluídos. Ajustes e aprovações são feitos somente pela Administração." />

    <section className="panel family-highlight">
      <strong>Indicação e remuneração são coisas diferentes</strong>
      <p className="mb-0">Seu link de indicação registra a origem de uma nova família. Ele não gera comissão automática. Esta página mostra somente remuneração pelo acompanhamento realizado e validado.</p>
    </section>

    <div className="stats-grid mt-16">
      <StatCard value={reviewing} label="Em conferência" />
      <StatCard value={money(approved)} label="Aprovado" />
      <StatCard value={money(paid)} label="Pago" />
    </div>

    <section className="panel">
      <div className="panel-head"><div><h2>Histórico de repasses</h2><p>Os valores são somente leitura no Portal do Professor. Quando a Administração marcar um repasse como pago, a situação fica registrada aqui.</p></div></div>
      {(payouts ?? []).length ? <div className="form-stack">{(payouts ?? []).map((item: any) => <article className="mission-card" key={item.id}>
        <div className="flex space-between gap-8 wrap"><div><strong>{monthLabel(item.reference_month)}</strong><p>{studentName.get(item.student_id) || "Aluno"} · {planName.get(item.plan_id) || "Plano PLUMARELI"}</p></div><Badge tone={tone(item.status)}>{statusLabel(item.status)}</Badge></div>
        <div className="record-meta-grid mt-12">
          <span><small>Regra</small><strong>{modelLabel(item.compensation_model)}</strong></span>
          <span><small>Encontros concluídos</small><strong>{item.completed_meetings}</strong></span>
          <span><small>Encontros remuneráveis</small><strong>{item.billable_meetings}</strong></span>
          <span><small>Cálculo</small><strong>{money(item.calculated_amount)}</strong></span>
          <span><small>Ajuste administrativo</small><strong>{money(item.adjustment_amount)}</strong></span>
          <span><small>Valor final</small><strong>{money(item.final_amount)}</strong></span>
        </div>
        <p className="muted text-small">Base: {item.compensation_model === "percent_plan" ? `${Number(item.base_value || 0).toLocaleString("pt-BR")}%` : money(item.base_value)}. Encontros cancelados não entram no cálculo.</p>
        {item.admin_note ? <div className="notice"><strong>Observação da Administração:</strong> {item.admin_note}</div> : null}
      </article>)}</div> : <EmptyState title="Nenhum repasse registrado" description="Quando houver uma competência fechada com pagamento da família e trabalho concluído, o histórico aparecerá aqui." />}
    </section>
  </>;
}
