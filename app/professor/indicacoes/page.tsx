import Link from "next/link";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { ReferralShare } from "@/components/referral-share";
import { getCurrentTeacher } from "@/lib/teacher";
import { getSiteOrigin } from "@/lib/site-url";

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Bahia" }).format(new Date(value));
}

function statusLabel(value: string) {
  if (value === "payment_confirmed") return "Pagamento confirmado";
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
  const siteUrl = getSiteOrigin();
  const referralLink = summary?.code ? `${siteUrl}/convite/${summary.code}` : "";

  return <>
    <PageHeader eyebrow="Professor • Conta" title="Indicações" description="Compartilhe seu link profissional e acompanhe a jornada da família desde o primeiro contato até a confirmação do pagamento." />

    <section className="panel family-highlight">
      <div className="flex space-between gap-8 wrap">
        <div><strong>Indicação não é comissão</strong><p className="mb-0">Seu link registra quem apresentou o PLUMARELI à família. A remuneração do professor é calculada separadamente pelo trabalho educacional realizado.</p></div>
        <Link className="button button-secondary button-small" href="/professor/repasses">Ver meus repasses</Link>
      </div>
    </section>

    {!summary?.program_active ? <div className="notice">A campanha de indicações está pausada no momento. Seu código continua reservado para uma próxima campanha.</div> : null}

    <section className="panel">
      <div className="panel-head"><div><h2>Seu link exclusivo</h2><p>Quando a família abrir este link e enviar o interesse, a origem fica registrada. A Administração continua validando a matrícula e o professor responsável.</p></div></div>
      {summary?.program_active && referralLink ? <ReferralShare link={referralLink} title="Conheça o PLUMARELI" /> : <p className="muted">O compartilhamento será liberado quando a campanha estiver ativa.</p>}
    </section>

    <section className="panel">
      <div className="panel-head"><div><h2>Como a indicação avança</h2><p>Você consegue entender em que etapa cada contato está sem misturar essa jornada com o financeiro.</p></div></div>
      <div className="referral-guide-grid">
        <article className="referral-guide-step"><span>1</span><strong>Interesse recebido</strong><p>A família chega pelo seu link e a origem é registrada.</p></article>
        <article className="referral-guide-step"><span>2</span><strong>Matrícula concluída</strong><p>A Administração organiza aluno, plano e professor responsável.</p></article>
        <article className="referral-guide-step"><span>3</span><strong>Pagamento confirmado</strong><p>A conversão da indicação fica confirmada. Repasse só existe depois do trabalho realizado.</p></article>
      </div>
    </section>

    <div className="stats-grid">
      <article className="stat-card"><strong>{summary?.total_referrals ?? 0}</strong><span>Origens registradas</span><small>Contatos que chegaram pelo seu link</small></article>
      <article className="stat-card"><strong>{summary?.confirmed_referrals ?? 0}</strong><span>Conversões confirmadas</span><small>Primeira mensalidade já confirmada</small></article>
    </div>

    <section className="panel">
      <div className="panel-head"><div><h2>Histórico das indicações</h2><p>Acompanhe o que aconteceu com cada contato. Valores de remuneração ficam em “Meus repasses”.</p></div></div>
      {(activity ?? []).length ? <div className="form-stack">{(activity ?? []).map((item: any) => <article className="mission-card" key={item.referral_id}><div className="flex space-between gap-8 wrap"><div><strong>{item.guardian_name || "Nova família"}</strong><p>{item.child_name || "Criança ainda não informada"} · recebido em {dt(item.created_at)}</p></div><Badge tone={item.status === "payment_confirmed" ? "green" : item.status === "enrolled" ? "blue" : item.status === "cancelled" ? "neutral" : "yellow"}>{statusLabel(item.status)}</Badge></div></article>)}</div> : <EmptyState title="Nenhuma indicação ainda" description="Quando uma família usar seu link, a origem aparecerá aqui." />}
    </section>
  </>;
}
