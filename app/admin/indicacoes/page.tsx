import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { reviewReferralBenefit, updateReferralProgram } from "./actions";

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Bahia" }).format(new Date(value));
}

function benefitLabel(item: any) {
  const teacherBenefit = Boolean(item.beneficiary_teacher_id);
  if (item.benefit_type === "percent_discount") return `${Number(item.benefit_percent || 0).toLocaleString("pt-BR")}% ${teacherBenefit ? "de benefício" : "de desconto"}`;
  if (item.benefit_type === "fixed_discount") {
    const value = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(item.benefit_amount || 0));
    return teacherBenefit ? `${value} de bônus` : `${value} de desconto`;
  }
  const labels: Record<string, string> = { courses: "Modo Pensar extra", meetings: "Encontro extra", missions: "Missão extra", materials: "Material extra", notebooks: "Atividade extra", assessments: "Avaliação extra" };
  return labels[item.extra_resource_key] || "Recurso extra";
}

function referralStatus(value: string) {
  if (value === "payment_confirmed") return "Primeira mensalidade confirmada";
  if (value === "enrolled") return "Matrícula concluída";
  if (value === "cancelled") return "Encerrada";
  return "Novo interesse";
}

function CampaignForm({ ownerType, settings }: { ownerType: "guardian" | "teacher"; settings: any }) {
  const teacher = ownerType === "teacher";
  const title = teacher ? "Indicações de Professor" : "Indicações de Família";
  const description = teacher
    ? "Regra exclusiva para professores que compartilham o próprio link de indicação."
    : "Regra exclusiva para famílias que compartilham o próprio link de indicação.";

  return <section className="panel">
    <div className="panel-head"><div><h2>{title}</h2><p>{description}</p></div><Badge tone={settings?.active ? "green" : "neutral"}>{settings?.active ? "Ativa" : "Pausada"}</Badge></div>
    <form action={updateReferralProgram} className="form-stack">
      <input type="hidden" name="ownerType" value={ownerType} />
      <label className="preference-toggle"><span><strong>Campanha ativa</strong><small>Quando desligada, os links deste perfil ficam reservados mas não aceitam novas indicações.</small></span><input type="checkbox" name="active" defaultChecked={Boolean(settings?.active)} /></label>
      <div className="form-row">
        <div className="field"><label>Tipo de benefício</label><select className="select" name="benefitType" defaultValue={settings?.benefit_type || "none"}><option value="none">Sem benefício</option><option value="percent_discount">{teacher ? "Benefício percentual" : "Desconto percentual"}</option><option value="fixed_discount">{teacher ? "Bônus em valor" : "Desconto em valor"}</option><option value="extra_resource">Recurso extra</option></select></div>
        <div className="field"><label>Indicações confirmadas necessárias</label><input className="input" name="requiredConfirmedReferrals" type="number" min="1" max="100" defaultValue={settings?.required_confirmed_referrals || 1} required /></div>
      </div>
      <div className="form-row">
        <div className="field"><label>Percentual, se usado</label><input className="input" name="benefitPercent" type="number" min="0.01" max="100" step="0.01" defaultValue={settings?.benefit_percent ?? ""} placeholder="Ex.: 10" /></div>
        <div className="field"><label>{teacher ? "Valor do bônus, se usado" : "Valor do desconto, se usado"}</label><input className="input" name="benefitAmount" type="number" min="0.01" step="0.01" defaultValue={settings?.benefit_amount ?? ""} placeholder="Ex.: 30,00" /></div>
      </div>
      <div className="field"><label>Recurso extra, se usado</label><select className="select" name="extraResourceKey" defaultValue={settings?.extra_resource_key || ""}><option value="">Não selecionar</option><option value="courses">Modo Pensar</option><option value="meetings">Encontro</option><option value="missions">Missão</option><option value="notebooks">Atividade / Caderno</option><option value="materials">Material</option><option value="assessments">Avaliação</option></select></div>
      <div className="form-row"><div className="field"><label>Início da campanha</label><input className="input" name="startsAt" type="date" defaultValue={settings?.starts_at || ""} /></div><div className="field"><label>Fim da campanha</label><input className="input" name="endsAt" type="date" defaultValue={settings?.ends_at || ""} /></div></div>
      <div className="field"><label>Regra que {teacher ? "o professor" : "a família"} pode ler</label><textarea className="textarea" name="publicRules" defaultValue={settings?.public_rules || ""} placeholder="Explique de forma simples quando o benefício é liberado." /></div>
      <div className="notice">A confirmação continua acontecendo somente depois do primeiro pagamento da família indicada. O benefício fica disponível para revisão administrativa e não altera cobrança automaticamente.</div>
      <button className="button button-primary" type="submit">Salvar campanha de {teacher ? "Professor" : "Família"}</button>
    </form>
  </section>;
}

export default async function AdminReferralsPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  await requireRole("admin");
  const supabase = await createClient();
  const [{ data: settingsRows }, { data: referrals }, { data: benefits }] = await Promise.all([
    supabase.from("referral_program_settings").select("*").order("owner_type"),
    supabase.from("referrals").select("id,status,created_at,enrolled_at,confirmed_at,referral_code_id,enrollment_request_id,referral_codes(code,owner_type,guardian_id,teacher_id),enrollment_requests(guardian_name,child_name,assigned_to_teacher_id)").order("created_at", { ascending: false }).limit(200),
    supabase.from("referral_benefits").select("id,referral_id,beneficiary_guardian_id,beneficiary_teacher_id,benefit_type,benefit_percent,benefit_amount,extra_resource_key,status,available_at,applied_at,admin_note").order("created_at", { ascending: false }).limit(120),
  ]);

  const familySettings = (settingsRows ?? []).find((item: any) => item.owner_type === "guardian");
  const teacherSettings = (settingsRows ?? []).find((item: any) => item.owner_type === "teacher");
  const codes = (referrals ?? []).map((item: any) => Array.isArray(item.referral_codes) ? item.referral_codes[0] : item.referral_codes).filter(Boolean);
  const guardianIds = [...new Set([...codes.map((item: any) => item.guardian_id), ...(benefits ?? []).map((item: any) => item.beneficiary_guardian_id)].filter(Boolean))];
  const teacherIds = [...new Set([...codes.map((item: any) => item.teacher_id), ...(benefits ?? []).map((item: any) => item.beneficiary_teacher_id)].filter(Boolean))];
  const [{ data: guardians }, { data: teachers }] = await Promise.all([
    guardianIds.length ? supabase.from("guardians").select("id,profile_id,profiles(full_name,preferred_name)").in("id", guardianIds) : Promise.resolve({ data: [] as any[] }),
    teacherIds.length ? supabase.from("teachers").select("id,profile_id,profiles(full_name,preferred_name)").in("id", teacherIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const guardianName = new Map((guardians ?? []).map((item: any) => [item.id, item.profiles?.preferred_name || item.profiles?.full_name || "Família"]));
  const teacherName = new Map((teachers ?? []).map((item: any) => [item.id, item.profiles?.preferred_name || item.profiles?.full_name || "Professor"]));
  const referralById = new Map((referrals ?? []).map((item: any) => [item.id, item]));
  const confirmedCount = (referrals ?? []).filter((item: any) => item.status === "payment_confirmed").length;
  const availableBenefits = (benefits ?? []).filter((item: any) => item.status === "available").length;

  return <>
    <PageHeader eyebrow="Admin • Operação" title="Indicações" description="Família e Professor têm campanhas independentes, com links, regras e benefícios separados." />
    {query.erro && <div className="form-message form-error">{query.erro}</div>}
    {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

    <div className="stats-grid">
      <StatCard value={(referrals ?? []).length} label="Indicações registradas" />
      <StatCard value={confirmedCount} label="Primeiros pagamentos confirmados" />
      <StatCard value={availableBenefits} label="Benefícios disponíveis" />
      <StatCard value={`${familySettings?.active ? "Família ativa" : "Família pausada"} • ${teacherSettings?.active ? "Professor ativo" : "Professor pausado"}`} label="Campanhas" />
    </div>

    <div className="grid-2">
      <CampaignForm ownerType="guardian" settings={familySettings} />
      <CampaignForm ownerType="teacher" settings={teacherSettings} />
    </div>

    <section className="panel">
      <div className="panel-head"><div><h2>Benefícios para revisar</h2><p>Famílias e professores aparecem juntos aqui, sempre identificados pelo perfil que fez a indicação.</p></div></div>
      {availableBenefits ? <div className="form-stack">{(benefits ?? []).filter((item: any) => item.status === "available").map((item: any) => {
        const referral: any = referralById.get(item.referral_id);
        const target: any = Array.isArray(referral?.enrollment_requests) ? referral.enrollment_requests[0] : referral?.enrollment_requests;
        const teacherBenefit = Boolean(item.beneficiary_teacher_id);
        const beneficiary = teacherBenefit ? teacherName.get(item.beneficiary_teacher_id) || "Professor indicador" : guardianName.get(item.beneficiary_guardian_id) || "Família indicadora";
        return <article className="mission-card" key={item.id}><div className="flex space-between gap-8 wrap"><div><strong>{beneficiary}</strong><p>{benefitLabel(item)} · indicação de {target?.child_name || target?.guardian_name || "nova família"}</p></div><Badge tone="green">{teacherBenefit ? "Professor" : "Família"} · disponível</Badge></div><form action={reviewReferralBenefit} className="form-stack compact-form mt-16"><input type="hidden" name="benefitId" value={item.id} /><div className="field"><label>Observação <span className="field-optional">opcional</span></label><input className="input" name="note" placeholder={teacherBenefit ? "Ex.: bônus pago" : "Ex.: aplicado na próxima mensalidade"} /></div><div className="flex gap-8 wrap"><button className="button button-primary button-small" name="decision" value="apply" type="submit">Marcar como utilizado</button><button className="button button-ghost button-small" name="decision" value="cancel" type="submit">Encerrar benefício</button></div></form></article>;
      })}</div> : <EmptyState title="Nenhum benefício aguardando" description="Quando uma indicação cumprir a regra da campanha correspondente, ela aparecerá aqui." />}
    </section>

    <section className="panel">
      <div className="panel-head"><div><h2>Histórico de indicações</h2><p>A origem permanece registrada do primeiro interesse até a confirmação do pagamento.</p></div></div>
      {(referrals ?? []).length ? <div className="form-stack">{(referrals ?? []).map((item: any) => {
        const code: any = Array.isArray(item.referral_codes) ? item.referral_codes[0] : item.referral_codes;
        const target: any = Array.isArray(item.enrollment_requests) ? item.enrollment_requests[0] : item.enrollment_requests;
        const source = code?.owner_type === "teacher" ? `Professor: ${teacherName.get(code.teacher_id) || "Professor"}` : `Família: ${guardianName.get(code?.guardian_id) || "Família"}`;
        return <article className="mission-card" key={item.id}><div className="flex space-between gap-8 wrap"><div><strong>{target?.guardian_name || "Novo contato"}</strong><p>{target?.child_name || "Criança ainda não informada"} · {source}</p><small className="muted">Recebido em {dt(item.created_at)}</small></div><Badge tone={item.status === "payment_confirmed" ? "green" : item.status === "enrolled" ? "blue" : item.status === "cancelled" ? "neutral" : "yellow"}>{referralStatus(item.status)}</Badge></div></article>;
      })}</div> : <EmptyState title="Nenhuma indicação registrada" description="Quando um link de Família ou Professor for usado, a origem aparecerá aqui." />}
    </section>
  </>;
}
