import Link from "next/link";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { enterStudentSpace } from "@/app/familia/access-actions";
import { getFamilyPortal } from "@/lib/family";

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bahia" }).format(new Date(value));
}

function childHref(path: string, studentId: string) {
  return `${path}?aluno=${encodeURIComponent(studentId)}`;
}

export default async function FamilyPage({ searchParams }: { searchParams: Promise<{ aluno?: string; erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { children, selectedChild, supabase } = await getFamilyPortal(query.aluno || null);

  if (!children.length || !selectedChild) {
    return <><PageHeader eyebrow="Ninho da Família" title="Acompanhando" description="Uma visão acolhedora e objetiva da jornada escolar." /><EmptyState title="Nenhuma criança vinculada" description="A administração precisa aprovar o vínculo da família com a criança." /></>;
  }

  const studentId = selectedChild.student_id;
  const now = new Date().toISOString();

  const [
    { data: missions },
    { data: notebooks },
    { data: assessments },
    { data: eventLinks },
    { data: states },
    { count: sentContents },
    { data: currentContents },
  ] = await Promise.all([
    supabase.from("mission_students").select("id,status,due_at,completed_at,progress_percent,missions(title)").eq("student_id", studentId).order("assigned_at", { ascending: false }).limit(80),
    supabase.from("notebook_assignments").select("id,status,due_at,submitted_at,teacher_note,score,needs_redo,redo_note,notebook_activities(title)").eq("student_id", studentId).order("created_at", { ascending: false }).limit(60),
    supabase.from("assessment_students").select("id,status,score,assessments(title,scheduled_for,subjects(name))").eq("student_id", studentId).order("created_at", { ascending: false }).limit(40),
    supabase.from("agenda_event_students").select("event_id,agenda_events(id,title,event_type,starts_at,ends_at,status,meeting_url,visible_to_guardian)").eq("student_id", studentId).limit(60),
    selectedChild.can_view_progress ? supabase.from("student_skill_states").select("domain_level,evidence_count,trend").eq("student_id", studentId).limit(100) : Promise.resolve({ data: [] as any[] }),
    supabase.from("family_school_uploads").select("id", { count: "exact", head: true }).eq("student_id", studentId),
    supabase.from("student_current_contents").select("id,confirmed,is_manual,subjects(name),contents(name)").eq("student_id", studentId).eq("active", true).limit(6),
  ]);

  const completedMissions = (missions ?? []).filter((item: any) => ["completed", "reviewed"].includes(String(item.status))).length;
  const pendingMissions = (missions ?? []).filter((item: any) => ["assigned", "in_progress"].includes(String(item.status))).length;
  const pendingActivities = (notebooks ?? []).filter((item: any) => ["assigned", "in_progress"].includes(item.status) || item.needs_redo).length;
  const redoActivities = (notebooks ?? []).filter((item: any) => item.needs_redo).length;
  const futureAssessments = (assessments ?? []).filter((item: any) => item.assessments?.scheduled_for && new Date(item.assessments.scheduled_for) >= new Date()).sort((a: any, b: any) => +new Date(a.assessments.scheduled_for) - +new Date(b.assessments.scheduled_for));
  const nextAssessment = futureAssessments[0];
  const futureEvents = (eventLinks ?? []).filter((item: any) => item.agenda_events?.visible_to_guardian && item.agenda_events?.status !== "cancelled" && item.agenda_events?.starts_at && item.agenda_events.starts_at >= now).sort((a: any, b: any) => +new Date(a.agenda_events.starts_at) - +new Date(b.agenda_events.starts_at));
  const nextEvent = futureEvents[0]?.agenda_events;
  const reviewedNotebooks = (notebooks ?? []).filter((item: any) => item.teacher_note || item.score != null);
  const recentFeedback = reviewedNotebooks[0];
  const evidencedStates = (states ?? []).filter((state: any) => Number(state.evidence_count || 0) > 0);
  const progress = evidencedStates.length ? Math.round(evidencedStates.reduce((sum: number, state: any) => sum + Math.min(4, Number(state.domain_level || 0)), 0) / (evidencedStates.length * 4) * 100) : 0;
  const overdueMissions = (missions ?? []).filter((item: any) => ["assigned", "in_progress"].includes(String(item.status)) && item.due_at && new Date(item.due_at) < new Date()).length;
  const overdueNotebooks = (notebooks ?? []).filter((item: any) => ["assigned", "in_progress"].includes(item.status) && item.due_at && new Date(item.due_at) < new Date()).length;
  const alertCount = overdueMissions + overdueNotebooks + redoActivities;

  return (
    <>
      <PageHeader
        eyebrow="Ninho da Família"
        title={`Acompanhando ${selectedChild.student_name}`}
        description="Próximos compromissos, pendências e evolução da criança escolhida na lateral."
      />
      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <section className="family-overview-hero">
        <div>
          <Badge tone={selectedChild.student_status === "active" ? "green" : "neutral"}>{selectedChild.student_status === "active" ? "Acompanhamento ativo" : selectedChild.student_status}</Badge>
          <h2>{selectedChild.student_name}</h2>
          <p>{selectedChild.grade_name || "Ano escolar não informado"}{selectedChild.school_name ? ` · ${selectedChild.school_name}` : ""}</p>
          <div className="family-overview-meta">
            <Badge tone="blue">Professor(a): {selectedChild.teacher_name || "A definir"}</Badge>
            {(selectedChild.tracked_subjects ?? []).map((subject) => <Badge tone="purple" key={subject}>{subject}</Badge>)}
          </div>
          <div className="flex gap-8 wrap mt-16">
            <Link className="button button-secondary button-small" href={childHref("/familia/progresso", studentId)}>Ver acompanhamento</Link>
            <form action={enterStudentSpace}><input type="hidden" name="studentId" value={studentId} /><button className="button button-primary button-small" type="submit">Entrar no espaço da criança</button></form>
          </div>
        </div>

        <div className="family-metric-grid">
          <div className="family-metric"><strong>{completedMissions}</strong><span>Missões concluídas</span></div>
          <div className="family-metric"><strong>{pendingMissions}</strong><span>Missões pendentes</span></div>
          <div className="family-metric"><strong>{pendingActivities}</strong><span>Atividades pendentes</span></div>
          <div className="family-metric"><strong>{progress}%</strong><span>Progresso observado</span></div>
        </div>
      </section>

      <div className="family-dashboard-grid">
        <article className="family-summary-card">
          <Badge tone="blue">Próxima aula / encontro</Badge>
          <h3>{nextEvent?.title || "Nenhum encontro marcado"}</h3>
          <p>{nextEvent ? dt(nextEvent.starts_at) : "Quando o professor agendar, aparecerá aqui."}</p>
          {nextEvent?.meeting_url && <a className="button button-primary button-small mt-12" href={nextEvent.meeting_url} target="_blank" rel="noreferrer">Entrar ↗</a>}
        </article>

        <article className="family-summary-card">
          <Badge tone="purple">Próxima avaliação</Badge>
          <h3>{nextAssessment?.assessments?.title || "Nenhuma avaliação próxima"}</h3>
          <p>{nextAssessment?.assessments?.scheduled_for ? `${nextAssessment.assessments.subjects?.name || "Avaliação"} · ${dt(nextAssessment.assessments.scheduled_for)}` : "Você também pode informar uma prova recebida da escola."}</p>
          <Link className="button button-secondary button-small mt-12" href={childHref("/familia/avaliacoes", studentId)}>Abrir avaliações</Link>
        </article>

        <article className="family-summary-card">
          <Badge tone={alertCount ? "yellow" : "green"}>Alertas</Badge>
          <h3>{alertCount ? `${alertCount} item(ns) precisam de atenção` : "Nenhum alerta no momento"}</h3>
          <p>{redoActivities ? `${redoActivities} atividade(s) para refazer.` : overdueMissions + overdueNotebooks ? "Há atividade(s) com prazo vencido." : "Tudo em dia por aqui."}</p>
          {alertCount ? <Link className="button button-secondary button-small mt-12" href={childHref("/familia/atividades", studentId)}>Ver pendências</Link> : null}
        </article>

        <article className="family-summary-card">
          <Badge tone="pink">Feedback recente</Badge>
          <h3>{recentFeedback?.notebook_activities?.title || "Ainda sem feedback novo"}</h3>
          <p>{recentFeedback?.teacher_note || "As devolutivas da professora aparecem aqui depois das correções."}</p>
        </article>

        <article className="family-summary-card">
          <Badge tone="green">Conteúdo enviado</Badge>
          <h3>{sentContents ?? 0} arquivo(s) da escola</h3>
          <p>Fotos do caderno, PDFs, atividades e avisos enviados pela família.</p>
          <Link className="button button-secondary button-small mt-12" href={childHref("/familia/conteudos", studentId)}>Enviar conteúdo</Link>
        </article>

        <article className="family-summary-card">
          <Badge tone="blue">Estudando agora</Badge>
          <h3>{currentContents?.[0]?.contents?.name || "Conteúdo em atualização"}</h3>
          <p>{currentContents?.[0]?.subjects?.name || "O conteúdo atual aparecerá conforme o acompanhamento avançar."}</p>
        </article>
      </div>

      <section className="panel mt-16">
        <div className="panel-head"><div><h2>Meus filhos</h2><p>{children.length} {children.length === 1 ? "criança vinculada" : "crianças vinculadas"}. Trocar aqui também atualiza o restante da área.</p></div></div>
        <div className="family-action-grid">
          {children.map((child) => (
            <article className="family-summary-card" key={child.student_id}>
              <Badge tone={child.student_id === studentId ? "green" : "neutral"}>{child.student_id === studentId ? "Acompanhando agora" : "Vinculado"}</Badge>
              <h3>{child.student_name}</h3>
              <p>{child.grade_name || "Ano não informado"}{child.school_name ? ` · ${child.school_name}` : ""}</p>
              <small className="muted">Professor(a): {child.teacher_name || "A definir"}</small>
              <div className="flex gap-8 wrap mt-12">
                <Link className="button button-secondary button-small" href={childHref("/familia", child.student_id)}>Ver acompanhamento</Link>
                <form action={enterStudentSpace}><input type="hidden" name="studentId" value={child.student_id} /><button className="button button-primary button-small" type="submit">Entrar no espaço</button></form>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
