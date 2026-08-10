import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { getFamilyPortal } from "@/lib/family";

function money(value: unknown) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function date(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
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

  const { data: subscriptions } = await supabase
    .from("subscriptions")
    .select("id,status,agreed_monthly_price,starts_at,ends_at,plans(name,description,monthly_price,billing_interval,features,meetings_per_month,delivery_mode)")
    .eq("guardian_id", guardian.id)
    .eq("student_id", selectedChild.student_id)
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader eyebrow="Ninho da Família" title={`Plano de ${selectedChild.student_name}`} description="Plano contratado, valor, periodicidade e período do acompanhamento." />
      <section className="panel">
        {subscriptions?.length ? <div className="form-stack">{subscriptions.map((sub: any) => (
          <article className="family-upload-card" key={sub.id}>
            <div className="flex space-between gap-8 wrap">
              <div><Badge tone={sub.status === "active" ? "green" : sub.status === "pending" ? "yellow" : "neutral"}>{sub.status === "active" ? "Ativo" : sub.status === "pending" ? "Em preparação" : sub.status}</Badge><h2>{sub.plans?.name || "Plano CURIÓ"}</h2><p>{sub.plans?.description || "Acompanhamento escolar CURIÓ."}</p></div>
              <div><strong style={{ fontSize: 24 }}>{money(sub.agreed_monthly_price ?? sub.plans?.monthly_price)}</strong><div className="muted text-small">{intervalLabel(sub.plans?.billing_interval)}</div></div>
            </div>
            <div className="profile-lines mt-16">
              <div><span>Competência / período</span><strong>{date(sub.starts_at)} → {sub.ends_at ? date(sub.ends_at) : "em andamento"}</strong></div>
              <div><span>Encontros por mês</span><strong>{sub.plans?.meetings_per_month ?? 0}</strong></div>
              <div><span>Formato</span><strong>{sub.plans?.delivery_mode === "online" ? "Online" : sub.plans?.delivery_mode || "A definir"}</strong></div>
            </div>
            {Array.isArray(sub.plans?.features) && sub.plans.features.length ? <div className="flex gap-8 wrap mt-16">{sub.plans.features.map((feature: any, index: number) => <Badge tone="blue" key={`${String(feature)}-${index}`}>{typeof feature === "string" ? feature : feature?.label || feature?.name || "Benefício"}</Badge>)}</div> : null}
          </article>
        ))}</div> : <EmptyState title="Nenhum plano vinculado" description={`Quando o plano de ${selectedChild.student_name} for ativado, ele aparecerá aqui.`} />}
      </section>
    </>
  );
}
