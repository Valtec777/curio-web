import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { ReferralShare } from "@/components/referral-share";
import { getFamilyPortal } from "@/lib/family";

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Bahia" }).format(new Date(value));
}

function statusLabel(value: string) {
  if (value === "payment_confirmed") return "Primeira mensalidade confirmada";
  if (value === "enrolled") return "Matrícula concluída";
  if (value === "cancelled") return "Encerrada";
  return "Interesse recebido";
}

function benefitLabel(item: any) {
  if (item.benefit_type === "percent_discount") return `${Number(item.benefit_percent || 0).toLocaleString("pt-BR")}% de desconto disponível`;
  if (item.benefit_type === "fixed_discount") return `${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(item.benefit_amount || 0))} de desconto disponível`;
  if (item.benefit_type === "extra_resource") {
    const labels: Record<string, string> = { courses: "Acesso extra ao Modo Pensar", meetings: "Encontro extra", missions: "Missão extra", materials: "Material extra", notebooks: "Atividade extra" };
    return labels[item.extra_resource_key] || "Benefício extra disponível";
  }
  return "Benefício disponível";
}

export default async function FamilyReferralsPage() {
  const { guardian, supabase } = await getFamilyPortal(null);
  if (!guardian?.active) return <EmptyState title="Indicações indisponíveis" description="Seu acesso familiar ainda está sendo preparado." />;

  await supabase.rpc("ensure_my_referral_code", { p_owner_type: "guardian" });
  const [{ data: summaryRows }, { data: activity }, { data: benefits }] = await Promise.all([
    supabase.rpc("my_referral_summary", { p_owner_type: "guardian" }),
    supabase.rpc("my_referral_activity", { p_owner_type: "guardian" }),
    supabase.rpc("my_referral_benefits"),
  ]);
  const summary: any = summaryRows?.[0] || null;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://curioeducacao.vercel.app").replace(/\/$/, "");
  const referralLink = summary?.code ? `${siteUrl}/convite/${summary.code}` : "";

  return <>
    <PageHeader eyebrow="Ninho da Família" title="Indique o CURIÓ" description="Compartilhe o CURIÓ com outra família e acompanhe aqui quando a indicação avançar." />

    {!summary?.program_active ? <div className="notice">O programa de indicações está pausado no momento. Seu código fica reservado e volta a funcionar quando uma nova campanha for ativada.</div> : null}

    <section className="panel family-highlight">
      <div className="panel-head"><div><h2>Seu convite</h2><p>O benefício só é liberado quando a nova matrícula cumprir a regra da campanha e a primeira mensalidade for confirmada.</p></div></div>
      {summary?.program_active && referralLink ? <ReferralShare link={referralLink} title="Quero te apresentar o CURIÓ" /> : <p className="muted">Assim que a campanha estiver ativa, seu link aparecerá aqui.</p>}
      {summary?.public_rules ? <p className="muted text-small mt-16">{summary.public_rules}</p> : null}
    </section>

    <div className="stats-grid">
      <article className="stat-card"><strong>{summary?.total_referrals ?? 0}</strong><span>Indicações</span><small>Interesses registrados pelo seu link</small></article>
      <article className="stat-card"><strong>{summary?.confirmed_referrals ?? 0}</strong><span>Confirmadas</span><small>Com primeira mensalidade confirmada</small></article>
      <article className="stat-card"><strong>{summary?.available_benefits ?? 0}</strong><span>Benefícios disponíveis</span><small>Aguardando uso ou aplicação</small></article>
    </div>

    {(benefits ?? []).length ? <section className="panel"><div className="panel-head"><div><h2>Seus benefícios</h2><p>Benefícios conquistados aparecem aqui sem alterar sua mensalidade automaticamente.</p></div></div><div className="form-stack">{(benefits ?? []).map((item: any) => <article className="mission-card" key={item.id}><div className="flex space-between gap-8 wrap"><strong>{benefitLabel(item)}</strong><Badge tone={item.status === "available" ? "green" : item.status === "applied" ? "blue" : "neutral"}>{item.status === "available" ? "Disponível" : item.status === "applied" ? "Utilizado" : "Encerrado"}</Badge></div><small className="muted">Liberado em {dt(item.available_at)}</small></article>)}</div></section> : null}

    <section className="panel"><div className="panel-head"><div><h2>Suas indicações</h2><p>Acompanhe o andamento sem precisar pedir atualização à equipe.</p></div></div>{(activity ?? []).length ? <div className="form-stack">{(activity ?? []).map((item: any) => <article className="mission-card" key={item.referral_id}><div className="flex space-between gap-8 wrap"><div><strong>{item.child_name || "Nova família"}</strong><p>Indicação registrada em {dt(item.created_at)}</p></div><Badge tone={item.status === "payment_confirmed" ? "green" : item.status === "enrolled" ? "blue" : item.status === "cancelled" ? "neutral" : "yellow"}>{statusLabel(item.status)}</Badge></div></article>)}</div> : <EmptyState title="Nenhuma indicação ainda" description="Quando alguém usar seu link, o acompanhamento aparecerá aqui." />}</section>
  </>;
}
