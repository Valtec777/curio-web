import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { ReferralShare } from "@/components/referral-share";
import { getCurrentTeacher } from "@/lib/teacher";

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Bahia" }).format(new Date(value));
}

function statusLabel(value: string) {
  if (value === "payment_confirmed") return "Matrícula confirmada";
  if (value === "enrolled") return "Matrícula concluída";
  if (value === "cancelled") return "Encerrada";
  return "Interesse recebido";
}

export default async function TeacherReferralsPage() {
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) return <EmptyState title="Perfil incompleto" description="A administração precisa concluir seu perfil de professor." />;

  await supabase.rpc("ensure_my_referral_code", { p_owner_type: "teacher" });
  const [{ data: summaryRows }, { data: activity }] = await Promise.all([
    supabase.rpc("my_referral_summary", { p_owner_type: "teacher" }),
    supabase.rpc("my_referral_activity", { p_owner_type: "teacher" }),
  ]);
  const summary: any = summaryRows?.[0] || null;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://curioeducacao.vercel.app").replace(/\/$/, "");
  const referralLink = summary?.code ? `${siteUrl}/convite/${summary.code}` : "";

  return <>
    <PageHeader eyebrow="Professor • Conta" title="Indicações" description="Compartilhe seu link profissional. Quando uma família chegar por ele, a origem fica registrada para a Administração revisar na matrícula." />

    {!summary?.program_active ? <div className="notice">O programa de indicações está pausado no momento. Seu código continua reservado para uma próxima campanha.</div> : null}

    <section className="panel">
      <div className="panel-head"><div><h2>Seu link de indicação</h2><p>O link identifica apenas a origem do contato. A Administração continua escolhendo e confirmando o professor responsável pela matrícula.</p></div></div>
      {summary?.program_active && referralLink ? <ReferralShare link={referralLink} title="Conheça o CURIÓ" /> : <p className="muted">O compartilhamento será liberado quando a campanha estiver ativa.</p>}
    </section>

    <div className="stats-grid">
      <article className="stat-card"><strong>{summary?.total_referrals ?? 0}</strong><span>Contatos pelo seu link</span><small>Interesses com sua origem registrada</small></article>
      <article className="stat-card"><strong>{summary?.confirmed_referrals ?? 0}</strong><span>Matrículas confirmadas</span><small>Primeira mensalidade já confirmada</small></article>
    </div>

    <section className="panel">
      <div className="panel-head"><div><h2>Origem das matrículas</h2><p>Esta área mostra somente o acompanhamento da indicação. Valores internos e regras financeiras não fazem parte do portal do Professor.</p></div></div>
      {(activity ?? []).length ? <div className="form-stack">{(activity ?? []).map((item: any) => <article className="mission-card" key={item.referral_id}><div className="flex space-between gap-8 wrap"><div><strong>{item.guardian_name || "Nova família"}</strong><p>{item.child_name || "Criança ainda não informada"} · recebido em {dt(item.created_at)}</p></div><Badge tone={item.status === "payment_confirmed" ? "green" : item.status === "enrolled" ? "blue" : item.status === "cancelled" ? "neutral" : "yellow"}>{statusLabel(item.status)}</Badge></div></article>)}</div> : <EmptyState title="Nenhuma indicação ainda" description="Quando uma família usar seu link, a origem aparecerá aqui." />}
    </section>
  </>;
}
