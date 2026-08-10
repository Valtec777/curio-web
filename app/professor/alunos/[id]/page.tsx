import Link from "next/link";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { getCurrentTeacher } from "@/lib/teacher";

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bahia" }).format(new Date(value));
}

function date(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(`${String(value).slice(0, 10)}T12:00:00Z`));
}

export default async function TeacherStudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) return <EmptyState title="Perfil incompleto" description="A administração precisa concluir seu perfil de professor." />;

  const { data: link } = await supabase.from("teacher_students").select("student_id,students(id,preferred_name,full_name,school_name,status,grades(name))").eq("teacher_id", teacher.id).eq("student_id", id).eq("active", true).maybeSingle();
  const student: any = link?.students;
  if (!student) return <EmptyState title="Aluno indisponível" description="Este aluno não está vinculado ao seu perfil de professor." />;

  const [
    { data: contents },
    { data: states },
    { data: uploads },
    { data: reportedAssessments },
    { data: missions },
    { data: notebooks },
    { data: events },
  ] = await Promise.all([
    supabase.from("student_current_contents").select("subjects(name),contents(name),confirmed,is_manual").eq("student_id", id).eq("active", true).limit(20),
    supabase.from("student_skill_states").select("domain_level,autonomy_level,evidence_count,trend,priority,needs_teacher_review,skills(name)").eq("student_id", id).order("updated_at", { ascending: false }).limit(80),
    supabase.from("family_school_uploads").select("id,title,content_type,description,related_date,file_path,file_name,status,created_at,subjects(name)").eq("student_id", id).order("created_at", { ascending: false }).limit(40),
    supabase.from("family_assessment_reports").select("id,origin,title,assessment_date,content,observations,file_path,file_name,status,created_at,subjects(name)").eq("student_id", id).order("assessment_date", { ascending: false }).limit(40),
    supabase.from("mission_students").select("status,due_at,completed_at,progress_percent,after_score,missions(title)").eq("student_id", id).eq("assigned_by_teacher_id", teacher.id).order("assigned_at", { ascending: false }).limit(30),
    supabase.from("notebook_assignments").select("status,due_at,submitted_at,score,needs_redo,notebook_activities(title)").eq("student_id", id).eq("assigned_by_teacher_id", teacher.id).order("created_at", { ascending: false }).limit(30),
    supabase.from("agenda_events").select("id,title,event_type,starts_at,status,meeting_url,agenda_event_students(student_id)").eq("created_by_teacher_id", teacher.id).gte("starts_at", new Date().toISOString()).neq("status", "cancelled").order("starts_at").limit(80),
  ]);

  const familyFileUrls = new Map<string, string>();
  for (const item of uploads ?? []) {
    if (!item.file_path) continue;
    const { data } = await supabase.storage.from("family-uploads").createSignedUrl(item.file_path, 60 * 20);
    if (data?.signedUrl) familyFileUrls.set(`upload-${item.id}`, data.signedUrl);
  }
  for (const item of reportedAssessments ?? []) {
    if (!item.file_path) continue;
    const { data } = await supabase.storage.from("family-uploads").createSignedUrl(item.file_path, 60 * 20);
    if (data?.signedUrl) familyFileUrls.set(`assessment-${item.id}`, data.signedUrl);
  }

  const evidenced = (states ?? []).filter((state: any) => Number(state.evidence_count || 0) > 0);
  const avg = evidenced.length ? evidenced.reduce((sum: number, state: any) => sum + Number(state.domain_level || 0), 0) / evidenced.length : 0;
  const progress = Math.round((avg / 4) * 100);
  const nextEvent = (events ?? []).find((event: any) => (event.agenda_event_students ?? []).some((row: any) => row.student_id === id));
  const pending = [...(missions ?? []), ...(notebooks ?? [])].filter((item: any) => ["assigned", "in_progress", "submitted"].includes(String(item.status)) || item.needs_redo).length;
  const reviewStates = evidenced.filter((state: any) => state.needs_teacher_review).length;

  return (
    <>
      <PageHeader
        eyebrow="Professor • Aluno"
        title={student.preferred_name || student.full_name}
        description={`${student.grades?.name || "Ano não informado"} · ${student.school_name || "Escola não informada"}`}
        action={<Link className="button button-secondary" href="/professor/alunos">← Meus alunos</Link>}
      />

      <div className="family-dashboard-grid">
        <article className="family-summary-card"><Badge tone="blue">Progresso</Badge><h3>{evidenced.length ? `${progress}%` : "Começando"}</h3><p>Baseado nas habilidades com evidências.</p></article>
        <article className="family-summary-card"><Badge tone={pending ? "yellow" : "green"}>Pendências</Badge><h3>{pending}</h3><p>Missões, cadernos e entregas que ainda pedem acompanhamento.</p></article>
        <article className="family-summary-card"><Badge tone={reviewStates ? "pink" : "green"}>Mapa pedagógico</Badge><h3>{reviewStates}</h3><p>Habilidade(s) sinalizadas para revisão do professor.</p></article>
      </div>

      <div className="grid-2 mt-16">
        <section className="panel">
          <div className="panel-head"><div><h2>Conteúdo atual</h2><p>Matérias e conteúdos em acompanhamento.</p></div></div>
          {contents?.length ? <div className="flex gap-8 wrap">{contents.map((item: any, index: number) => <Badge tone={item.confirmed || item.is_manual ? "blue" : "neutral"} key={`${item.contents?.name}-${index}`}>{item.subjects?.name ? `${item.subjects.name}: ` : ""}{item.contents?.name || "Conteúdo"}</Badge>)}</div> : <p className="muted">Ainda não há conteúdo atual confirmado.</p>}
          <div className="mt-20"><strong>Próximo encontro</strong><p>{nextEvent ? `${dt(nextEvent.starts_at)} · ${nextEvent.title}` : "Nenhum encontro marcado."}</p>{nextEvent?.meeting_url ? <a className="button button-primary button-small" href={nextEvent.meeting_url} target="_blank" rel="noreferrer">Entrar ↗</a> : null}</div>
        </section>

        <section className="panel">
          <div className="panel-head"><div><h2>Habilidades observadas</h2><p>Leitura rápida do mapa atual.</p></div></div>
          {evidenced.length ? <div className="form-stack">{evidenced.slice(0, 14).map((state: any, index: number) => <article className="family-upload-row" key={`${state.skills?.name}-${index}`}><div><strong>{state.skills?.name || "Habilidade"}</strong><small>Domínio {state.domain_level}/4 · Autonomia {state.autonomy_level}/4 · {state.evidence_count} evidência(s)</small></div><Badge tone={Number(state.domain_level) >= 3 ? "green" : state.trend === "improving" ? "blue" : "yellow"}>{Number(state.domain_level) >= 3 ? "Consolidando" : state.trend === "improving" ? "Evoluindo" : "Reforçar"}</Badge></article>)}</div> : <EmptyState title="Sem evidências suficientes" description="O mapa começa a ganhar forma conforme as atividades são registradas." />}
        </section>
      </div>

      <section className="panel family-highlight">
        <div className="panel-head"><div><h2>Conteúdo enviado pela Família</h2><p>Fotos do caderno, PDFs, avisos e materiais recebidos da escola para este aluno.</p></div></div>
        {uploads?.length ? <div className="form-stack">{uploads.map((item: any) => <article className="family-upload-card" key={item.id}><div className="flex space-between gap-8 wrap"><div><div className="flex gap-8 wrap"><Badge tone="purple">Família</Badge>{item.subjects?.name ? <Badge tone="blue">{item.subjects.name}</Badge> : null}</div><h3>{item.title}</h3><p>{item.description || item.file_name}</p></div>{familyFileUrls.get(`upload-${item.id}`) ? <a className="button button-secondary button-small" href={familyFileUrls.get(`upload-${item.id}`)} target="_blank" rel="noreferrer">Abrir arquivo ↗</a> : null}</div><small className="muted">{item.related_date ? `Data relacionada: ${date(item.related_date)} · ` : ""}Enviado em {dt(item.created_at)}</small></article>)}</div> : <EmptyState title="Nada enviado pela família" description="Quando a família enviar material da escola, ele aparecerá aqui." />}
      </section>

      <section className="panel">
        <div className="panel-head"><div><h2>Avaliações informadas pela Família/Escola</h2><p>Provas e avaliações que podem orientar revisão e planejamento.</p></div></div>
        {reportedAssessments?.length ? <div className="form-stack">{reportedAssessments.map((item: any) => <article className="family-upload-card" key={item.id}><div className="flex space-between gap-8 wrap"><div><div className="flex gap-8 wrap"><Badge tone="pink">{item.origin === "school" ? "Escola" : "Responsável"}</Badge>{item.subjects?.name ? <Badge tone="blue">{item.subjects.name}</Badge> : null}</div><h3>{item.title}</h3><p>{item.content || "Conteúdo não detalhado."}</p></div>{familyFileUrls.get(`assessment-${item.id}`) ? <a className="button button-secondary button-small" href={familyFileUrls.get(`assessment-${item.id}`)} target="_blank" rel="noreferrer">Abrir anexo ↗</a> : null}</div><small className="muted">Avaliação em {date(item.assessment_date)}</small>{item.observations ? <p>{item.observations}</p> : null}</article>)}</div> : <EmptyState title="Nenhuma avaliação externa informada" description="Quando a família informar uma prova da escola, ela aparecerá aqui." />}
      </section>
    </>
  );
}
