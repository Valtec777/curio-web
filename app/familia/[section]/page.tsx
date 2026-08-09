import { notFound } from "next/navigation";
import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createSupportTicket } from "@/app/support-actions";
import { enterStudentSpace, setFamilyPin } from "@/app/familia/access-actions";

const sectionCopy: Record<string, { eyebrow: string; title: string; description: string }> = {
  filhos: { eyebrow: "Ninho da Família", title: "Meu filho / Meus filhos", description: "Os vínculos familiares autorizados para esta conta." },
  conteudos: { eyebrow: "Ninho da Família", title: "Conteúdos", description: "O que está sendo estudado agora, sem confundir conteúdo com habilidade." },
  atividades: { eyebrow: "Ninho da Família", title: "Atividades", description: "Missões e atividades de caderno em andamento ou concluídas." },
  progresso: { eyebrow: "Ninho da Família", title: "Progresso", description: "Uma leitura acolhedora do desenvolvimento, baseada em evidências repetidas." },
  avaliacoes: { eyebrow: "Ninho da Família", title: "Avaliações", description: "Avaliações, preparação e resultados disponíveis para acompanhamento." },
  agenda: { eyebrow: "Ninho da Família", title: "Agenda", description: "Encontros e compromissos visíveis para a família." },
  mensagens: { eyebrow: "Ninho da Família", title: "Mensagens", description: "Conversas com a equipe e professores do Curió." },
  relatorios: { eyebrow: "Ninho da Família", title: "Relatórios", description: "Relatórios gerados a partir de dados pedagógicos estruturados." },
  plano: { eyebrow: "Ninho da Família", title: "Plano", description: "Plano contratado e período de acompanhamento." },
  contrato: { eyebrow: "Ninho da Família", title: "Contrato", description: "Documentos e situação contratual do acompanhamento." },
  pagamentos: { eyebrow: "Ninho da Família", title: "Pagamentos", description: "Mensalidades, vencimentos e situação dos pagamentos." },
  perfil: { eyebrow: "Ninho da Família", title: "Perfil", description: "Dados do responsável vinculado à plataforma." },
  configuracoes: { eyebrow: "Ninho da Família", title: "Configurações", description: "Preferências da conta e privacidade." },
  suporte: { eyebrow: "Ninho da Família", title: "Suporte Curió", description: "Abra uma solicitação e acompanhe dúvidas de conta, plataforma ou financeiro." },
};

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bahia" }).format(new Date(value));
}

function familyProgress(level: number, count = 0) {
  if (count < 2) return "Nova habilidade";
  if (level >= 4) return "Consolidado";
  if (level >= 3) return "Praticando com autonomia";
  return "Em desenvolvimento";
}

export default async function FamilySectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const { section } = await params;
  const query = await searchParams;
  const copy = sectionCopy[section];
  if (!copy) notFound();
  const viewer = await requireRole("guardian");
  const supabase = await createClient();
  const { data: guardian } = await supabase.from("guardians").select("id").eq("profile_id", viewer.user.id).maybeSingle();
  if (!guardian) return <EmptyState title="Perfil da família incompleto" description="A administração precisa concluir o vínculo do responsável." />;
  const { data: links } = await supabase.from("guardian_students").select("student_id,relationship,can_view_progress,can_manage_access,students(id,preferred_name,full_name,school_name,grades(name))").eq("guardian_id", guardian.id);
  const studentIds = (links ?? []).map((item: any) => item.student_id);
  const studentName = new Map((links ?? []).map((item: any) => [item.student_id, item.students?.preferred_name || item.students?.full_name || "Criança"]));

  if (section === "filhos") {
    return <><PageHeader {...copy} /><section className="panel">{links?.length ? <div className="grid-3">{links.map((link: any) => <article className="mission-card family-child-card" key={link.student_id}><Badge tone="pink">{link.relationship || "Responsável"}</Badge><h3>{link.students?.preferred_name || link.students?.full_name}</h3><p>{link.students?.grades?.name || "Ano não informado"} {link.students?.school_name ? `• ${link.students.school_name}` : ""}</p><div className="flex gap-8 wrap"><Badge tone={link.can_view_progress ? "green" : "neutral"}>{link.can_view_progress ? "Progresso autorizado" : "Progresso restrito"}</Badge></div><small className="muted">A criança entra pelo mesmo e-mail do responsável. O PIN de 4 dígitos protege o retorno à área da família.</small><form action={enterStudentSpace}><input type="hidden" name="studentId" value={link.student_id}/><button className="button button-primary button-block" type="submit">Entrar no espaço de {link.students?.preferred_name || "criança"}</button></form></article>)}</div> : <EmptyState title="Nenhuma criança vinculada" description="A administração precisa aprovar o vínculo da família com a criança." />}</section></>;
  }

  if (section === "conteudos") {
    const { data: current } = studentIds.length ? await supabase.from("student_current_contents").select("student_id,confidence,is_manual,confirmed,starts_at,ends_at,subjects(name),contents(name)").in("student_id", studentIds).eq("active", true).order("updated_at", { ascending: false }) : { data: [] as any[] };
    return <><PageHeader {...copy} /><section className="panel family-highlight"><strong>Estudando agora</strong><p className="mb-0">Conteúdos inferidos aparecem como sugestão até a professora confirmar.</p></section><section className="panel">{current?.length ? <div className="grid-3">{current.map((item: any, index: number) => <article className="mission-card" key={index}><Badge tone={item.confirmed || item.is_manual ? "green" : "yellow"}>{item.confirmed || item.is_manual ? "Confirmado" : "Sugestão"}</Badge><h3>{item.contents?.name || "Conteúdo"}</h3><p>{item.subjects?.name || "Matéria"} • {studentName.get(item.student_id)}</p></article>)}</div> : <EmptyState title="Nenhum conteúdo atual informado" description="Conteúdos recentes aparecerão aqui conforme missões, materiais e avaliações forem publicados." />}</section></>;
  }

  if (section === "atividades") {
    const [{ data: missions }, { data: notebooks }] = studentIds.length ? await Promise.all([
      supabase.from("mission_students").select("id,student_id,status,due_at,completed_at,progress_percent,missions(title,objective,estimated_minutes)").in("student_id", studentIds).order("assigned_at", { ascending: false }).limit(40),
      supabase.from("notebook_assignments").select("id,student_id,status,due_at,submitted_at,stars_awarded,notebook_activities(title,description)").in("student_id", studentIds).order("submitted_at", { ascending: false, nullsFirst: false }).limit(30),
    ]) : [{ data: [] as any[] }, { data: [] as any[] }];
    return <><PageHeader {...copy} /><div className="grid-2"><section className="panel"><h2 className="mt-0">Missões</h2>{missions?.length ? <div className="form-stack">{missions.map((item: any) => <article className="mission-card" key={item.id}><strong>{item.missions?.title}</strong><p>{studentName.get(item.student_id)} • {item.progress_percent}%</p><Badge tone={item.status === "completed" ? "green" : "yellow"}>{item.status}</Badge></article>)}</div> : <p className="muted">Nenhuma missão recente.</p>}</section><section className="panel"><h2 className="mt-0">Caderno Curió</h2>{notebooks?.length ? <div className="form-stack">{notebooks.map((item: any) => <article className="mission-card" key={item.id}><strong>{item.notebook_activities?.title}</strong><p>{studentName.get(item.student_id)}</p><Badge tone={item.status === "completed" ? "green" : "blue"}>{item.status}</Badge></article>)}</div> : <p className="muted">Nenhuma atividade de caderno recente.</p>}</section></div></>;
  }

  if (section === "progresso") {
    const visibleIds = (links ?? []).filter((item: any) => item.can_view_progress).map((item: any) => item.student_id);
    const { data: states } = visibleIds.length ? await supabase.from("student_skill_states").select("student_id,domain_level,evidence_count,trend,confidence,skills(name)").in("student_id", visibleIds).order("updated_at", { ascending: false }).limit(60) : { data: [] as any[] };
    const consolidated = (states ?? []).filter((s: any) => s.evidence_count >= 2 && s.domain_level >= 3).length;
    const developing = (states ?? []).filter((s: any) => s.evidence_count >= 2 && s.domain_level < 3).length;
    const newSkills = (states ?? []).filter((s: any) => s.evidence_count < 2).length;
    return <><PageHeader {...copy} /><div className="stats-grid"><StatCard value={consolidated} label="Praticando com autonomia" /><StatCard value={developing} label="Em desenvolvimento" /><StatCard value={newSkills} label="Novas habilidades" /><StatCard value={(states ?? []).filter((s: any) => s.trend === "improving").length} label="Evolução recente" /></div><section className="panel"><div className="panel-head"><div><h2>Habilidades observadas</h2><p>A família recebe linguagem pedagógica adequada, não rótulos internos.</p></div></div>{states?.length ? <div className="grid-3">{states.map((state: any, index: number) => <article className="mission-card" key={index}><strong>{state.skills?.name}</strong><p>{studentName.get(state.student_id)}</p><Badge tone={state.domain_level >= 3 && state.evidence_count >= 2 ? "green" : state.evidence_count < 2 ? "neutral" : "yellow"}>{familyProgress(state.domain_level, state.evidence_count)}</Badge></article>)}</div> : <EmptyState title="O acompanhamento está começando" description="O progresso aparecerá quando houver evidências suficientes." />}</section></>;
  }

  if (section === "avaliacoes") {
    const { data: assessments } = studentIds.length ? await supabase.from("assessment_students").select("id,student_id,status,score,submitted_at,reviewed_at,assessments(title,scheduled_for,subjects(name))").in("student_id", studentIds).order("created_at", { ascending: false }).limit(40) : { data: [] as any[] };
    return <><PageHeader {...copy} /><section className="panel">{assessments?.length ? <div className="form-stack">{assessments.map((item: any) => <article className="mission-card" key={item.id}><div className="flex space-between gap-8 wrap"><div><Badge tone="blue">{item.assessments?.subjects?.name || "Avaliação"}</Badge><h3>{item.assessments?.title}</h3><p>{studentName.get(item.student_id)}</p></div><Badge tone={item.status === "reviewed" ? "green" : "yellow"}>{item.status}</Badge></div><small className="muted">{item.assessments?.scheduled_for ? dt(item.assessments.scheduled_for) : "Sem data definida"}</small></article>)}</div> : <EmptyState title="Nenhuma avaliação cadastrada" description="Avaliações futuras e revisadas aparecerão aqui." />}</section></>;
  }

  if (section === "agenda") {
    const { data: eventLinks } = studentIds.length ? await supabase.from("agenda_event_students").select("student_id,event_id,agenda_events(id,title,description,starts_at,ends_at,status,location,meeting_url,visible_to_guardian)").in("student_id", studentIds).limit(60) : { data: [] as any[] };
    const events = (eventLinks ?? []).filter((item: any) => item.agenda_events?.visible_to_guardian);
    return <><PageHeader {...copy} /><section className="panel">{events.length ? <div className="form-stack">{events.map((item: any) => <article className="mission-card" key={`${item.student_id}-${item.event_id}`}><strong>{item.agenda_events?.title}</strong><p>{studentName.get(item.student_id)} • {item.agenda_events?.description || "Encontro Curió"}</p><small className="muted">{dt(item.agenda_events?.starts_at)}{item.agenda_events?.location ? ` • ${item.agenda_events.location}` : ""}</small></article>)}</div> : <EmptyState title="Nenhum compromisso visível" description="A agenda da família será atualizada quando houver novos encontros." />}</section></>;
  }

  if (section === "mensagens") {
    const { data: threads } = await supabase.from("message_thread_participants").select("thread_id,last_read_at,message_threads(subject,thread_type,updated_at)").eq("user_id", viewer.user.id).limit(40);
    return <><PageHeader {...copy} /><section className="panel">{threads?.length ? <div className="form-stack">{threads.map((item: any) => <article className="mission-card" key={item.thread_id}><strong>{item.message_threads?.subject || "Conversa Curió"}</strong><p>{item.message_threads?.thread_type || "Mensagem"}</p><small className="muted">Atualizada em {dt(item.message_threads?.updated_at)}</small></article>)}</div> : <EmptyState title="Nenhuma conversa ainda" description="As mensagens da equipe e dos professores aparecerão aqui." />}</section></>;
  }

  if (section === "relatorios") {
    const { data: reports } = studentIds.length ? await supabase.from("generated_reports").select("id,student_id,report_type,period_start,period_end,created_at").in("student_id", studentIds).order("created_at", { ascending: false }).limit(40) : { data: [] as any[] };
    return <><PageHeader {...copy} /><section className="panel family-highlight"><strong>O relatório não é o diagnóstico.</strong><p className="mb-0">Ele é uma saída do mapa pedagógico estruturado e só usa informações sustentadas por evidências.</p></section><section className="panel">{reports?.length ? <div className="form-stack">{reports.map((report: any) => <article className="mission-card" key={report.id}><strong>{report.report_type}</strong><p>{studentName.get(report.student_id)}</p><small className="muted">{report.period_start || "—"} → {report.period_end || "—"} • {dt(report.created_at)}</small></article>)}</div> : <EmptyState title="Nenhum relatório disponível" description="Quando um relatório for gerado e liberado, ele aparecerá aqui." />}</section></>;
  }

  if (["plano", "contrato", "pagamentos"].includes(section)) {
    const { data: subs } = await supabase.from("subscriptions").select("id,student_id,status,agreed_monthly_price,starts_at,ends_at,plans(name,description,monthly_price,currency,features)").eq("guardian_id", guardian.id).order("created_at", { ascending: false });
    const subscriptionIds = (subs ?? []).map((s: any) => s.id);
    const [{ data: contracts }, { data: payments }] = subscriptionIds.length ? await Promise.all([
      supabase.from("contracts").select("id,subscription_id,status,document_path,signed_at,created_at").in("subscription_id", subscriptionIds),
      supabase.from("payments").select("id,subscription_id,amount,currency,due_date,paid_at,status,provider").in("subscription_id", subscriptionIds).order("due_date", { ascending: false }),
    ]) : [{ data: [] as any[] }, { data: [] as any[] }];
    if (section === "plano") return <><PageHeader {...copy} /><section className="panel">{subs?.length ? <div className="grid-3">{subs.map((sub: any) => <article className="mission-card" key={sub.id}><Badge tone={sub.status === "active" ? "green" : "neutral"}>{sub.status}</Badge><h3>{sub.plans?.name || "Plano Curió"}</h3><p>{studentName.get(sub.student_id)}</p><strong>R$ {Number(sub.agreed_monthly_price ?? sub.plans?.monthly_price ?? 0).toFixed(2).replace(".", ",")} / mês</strong></article>)}</div> : <EmptyState title="Nenhum plano vinculado" description="O plano contratado aparecerá aqui." />}</section></>;
    if (section === "contrato") return <><PageHeader {...copy} /><section className="panel">{contracts?.length ? <div className="form-stack">{contracts.map((contract: any) => <article className="mission-card" key={contract.id}><div className="flex space-between gap-8 wrap"><strong>Contrato Curió</strong><Badge tone={contract.status === "signed" ? "green" : "yellow"}>{contract.status}</Badge></div><small className="muted">{contract.signed_at ? `Assinado em ${dt(contract.signed_at)}` : `Criado em ${dt(contract.created_at)}`}</small></article>)}</div> : <EmptyState title="Nenhum contrato disponível" description="Quando o contrato for emitido, ele aparecerá aqui." />}</section></>;
    return <><PageHeader {...copy} /><section className="panel">{payments?.length ? <div className="form-stack">{payments.map((payment: any) => <article className="mission-card" key={payment.id}><div className="flex space-between gap-8 wrap"><strong>R$ {Number(payment.amount).toFixed(2).replace(".", ",")}</strong><Badge tone={payment.status === "paid" ? "green" : payment.status === "overdue" ? "pink" : "yellow"}>{payment.status}</Badge></div><p>Vencimento: {payment.due_date}</p>{payment.paid_at && <small className="muted">Pago em {dt(payment.paid_at)}</small>}</article>)}</div> : <EmptyState title="Nenhum pagamento registrado" description="As mensalidades aparecerão aqui." />}</section></>;
  }


  if (section === "suporte") {
    const { data: tickets } = await supabase.from("support_tickets").select("id,subject,description,category,priority,status,created_at,updated_at").eq("opened_by_user_id", viewer.user.id).order("updated_at", { ascending: false }).limit(40);
    return <><PageHeader {...copy} /><div className="grid-2"><section className="panel family-highlight"><div className="panel-head"><div><h2>Falar com o Curió</h2><p>Use este canal para dúvidas da plataforma, conta ou financeiro. Questões pedagógicas continuam sendo tratadas pela equipe responsável.</p></div></div><form action={createSupportTicket} className="form-stack"><input type="hidden" name="returnPath" value="/familia/suporte"/><div className="field"><label>Assunto</label><input className="input" name="subject" required/></div><div className="form-row"><div className="field"><label>Categoria</label><select className="select" name="category" defaultValue="platform"><option value="platform">Plataforma</option><option value="pedagogical">Acompanhamento pedagógico</option><option value="financial">Financeiro</option><option value="account">Conta e acesso</option><option value="other">Outro</option></select></div><div className="field"><label>Prioridade</label><select className="select" name="priority" defaultValue="normal"><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option></select></div></div><div className="field"><label>Como podemos ajudar?</label><textarea className="textarea" name="description" required/></div><button className="button button-primary" type="submit">Enviar solicitação</button></form></section><section className="panel"><div className="panel-head"><div><h2>Minhas solicitações</h2><p>Acompanhe a resposta da equipe.</p></div></div>{tickets?.length?<div className="form-stack">{tickets.map((t:any)=><article className="ticket-card" key={t.id}><div className="flex space-between gap-8 wrap"><strong>{t.subject}</strong><Badge tone={t.status==="resolved"||t.status==="closed"?"green":"yellow"}>{t.status}</Badge></div><p>{t.description}</p><small className="muted">{t.category} • {dt(t.updated_at)}</small></article>)}</div>:<EmptyState title="Nenhuma solicitação" description="Quando você precisar falar com a equipe, use o formulário ao lado."/>}</section></div></>;
  }

  if (["perfil", "configuracoes"].includes(section)) {
    const { data: profile } = await supabase.from("profiles").select("full_name,preferred_name,phone_whatsapp,preferences").eq("id", viewer.user.id).maybeSingle();
    if (section === "perfil") return <><PageHeader {...copy} /><section className="panel"><div className="profile-lines"><div><span>Nome</span><strong>{profile?.full_name || "Não informado"}</strong></div><div><span>E-mail</span><strong>{viewer.user.email}</strong></div><div><span>Telefone / WhatsApp</span><strong>{profile?.phone_whatsapp || "Não informado"}</strong></div></div></section></>;
    return <><PageHeader {...copy} />{query.erro && <div className="form-message form-error">{query.erro}</div>}{query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}<div className="grid-2"><section className="panel"><h2 className="mt-0">Privacidade por padrão</h2><p className="muted">A família vê somente informações previstas nas permissões da plataforma. Evidências pedagógicas brutas e classificações internas permanecem protegidas.</p><div className="notice">Preferências salvas: {profile?.preferences ? "sim" : "ainda não configuradas"}.</div></section><section className="panel family-highlight"><div className="panel-head"><div><h2>PIN do Ninho da Família</h2><p>Troque o PIN de 4 números usado para sair do espaço da criança e voltar aos controles dos responsáveis.</p></div></div><form action={setFamilyPin} className="form-stack"><input type="hidden" name="returnTo" value="/familia/configuracoes"/><div className="form-row"><div className="field"><label>Novo PIN</label><input className="input family-pin-input" name="pin" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{4}" minLength={4} maxLength={4} required placeholder="••••"/></div><div className="field"><label>Repita o PIN</label><input className="input family-pin-input" name="pinConfirmation" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{4}" minLength={4} maxLength={4} required placeholder="••••"/></div></div><button className="button button-primary" type="submit">Atualizar PIN</button></form></section></div></>;
  }

  notFound();
}
