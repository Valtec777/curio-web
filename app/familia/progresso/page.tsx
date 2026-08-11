import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { getFamilyPortal } from "@/lib/family";

function percent(value: number) { return `${Math.max(0, Math.min(100, Math.round(value)))}%`; }

export default async function FamilyProgressPage({ searchParams }: { searchParams: Promise<{ aluno?: string }> }) {
  const query = await searchParams;
  const { selectedChild, supabase } = await getFamilyPortal(query.aluno || null);
  if (!selectedChild) return <EmptyState title="Nenhuma criança vinculada" description="O progresso aparecerá quando houver uma criança vinculada." />;
  if (!selectedChild.can_view_progress) return <EmptyState title="Acompanhamento restrito" description="Este vínculo familiar não possui permissão para visualizar o progresso pedagógico." />;

  const [{ data: missions }, { data: notebooks }, { data: states }, { data: assessments }, { data: contents }] = await Promise.all([
    supabase.from("mission_students").select("status,started_at,completed_at,after_score,missions(subjects(name))").eq("student_id", selectedChild.student_id).limit(150),
    supabase.from("notebook_assignments").select("status,submitted_at,score,notebook_activities(subjects(name))").eq("student_id", selectedChild.student_id).limit(150),
    supabase.from("student_skill_states").select("domain_level,autonomy_level,evidence_count,trend,priority,skills(name)").eq("student_id", selectedChild.student_id).order("updated_at", { ascending: false }).limit(120),
    supabase.from("assessment_students").select("status,score,submitted_at,reviewed_at,assessments(title,scheduled_for,subjects(name))").eq("student_id", selectedChild.student_id).limit(80),
    supabase.from("student_current_contents").select("confirmed,is_manual,subjects(name),contents(name)").eq("student_id", selectedChild.student_id).eq("active", true).limit(30),
  ]);
  const missionRows = (missions ?? []) as any[];
  const notebookRows = (notebooks ?? []) as any[];
  const stateRows = (states ?? []) as any[];
  const assessmentRows = (assessments ?? []) as any[];
  const contentRows = (contents ?? []) as any[];

  const completedMissionRows = missionRows.filter((item) => ["completed", "reviewed"].includes(String(item.status)));
  const reviewedNotebookRows = notebookRows.filter((item) => item.status === "reviewed");
  const concluded = completedMissionRows.length + reviewedNotebookRows.length;
  const scores = [
    ...completedMissionRows.map((item) => Number(item.after_score)).filter(Number.isFinite),
    ...reviewedNotebookRows.map((item) => Number(item.score)).filter(Number.isFinite),
    ...assessmentRows.map((item) => Number(item.score)).filter(Number.isFinite),
  ];
  const achievement = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0;

  const activeDays = new Set<string>();
  for (const item of missionRows) for (const value of [item.started_at, item.completed_at]) if (value) activeDays.add(String(value).slice(0, 10));
  for (const item of notebookRows) if (item.submitted_at) activeDays.add(String(item.submitted_at).slice(0, 10));
  for (const item of assessmentRows) for (const value of [item.submitted_at, item.reviewed_at]) if (value) activeDays.add(String(value).slice(0, 10));

  const mastered = stateRows.filter((state) => Number(state.evidence_count) >= 2 && Number(state.domain_level) >= 3);
  const reinforce = stateRows
    .filter((state) => Number(state.evidence_count) >= 2 && Number(state.domain_level) < 3)
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
  const improving = stateRows.filter((state) => state.trend === "improving").length;

  const subjectScores = new Map<string, number[]>();
  const addSubjectScore = (subject: string | undefined, score: unknown) => {
    const value = Number(score);
    if (!subject || !Number.isFinite(value)) return;
    const values = subjectScores.get(subject) || [];
    values.push(value);
    subjectScores.set(subject, values);
  };
  for (const item of completedMissionRows) addSubjectScore(item.missions?.subjects?.name, item.after_score);
  for (const item of reviewedNotebookRows) addSubjectScore(item.notebook_activities?.subjects?.name, item.score);
  for (const item of assessmentRows) addSubjectScore(item.assessments?.subjects?.name, item.score);
  const subjectEvolution = [...subjectScores.entries()]
    .map(([name, values]) => ({ name, score: values.reduce((sum, value) => sum + value, 0) / values.length }))
    .sort((a, b) => b.score - a.score);

  const now = new Date();
  const nextAssessment = assessmentRows
    .filter((item) => item.assessments?.scheduled_for && new Date(item.assessments.scheduled_for) >= now)
    .sort((a, b) => +new Date(a.assessments.scheduled_for) - +new Date(b.assessments.scheduled_for))[0];
  const strongestSubject = subjectEvolution[0];
  const prioritySkill = reinforce[0];
  const currentContent = contentRows[0];

  const positiveSummary = strongestSubject
    ? `${strongestSubject.name} concentra os melhores resultados registrados até agora (${percent(strongestSubject.score)} de média nas evidências com nota).`
    : improving
      ? `${improving} habilidade(s) apresentam tendência recente de evolução.`
      : concluded
        ? `${concluded} atividade(s) já foram concluídas e estão formando o histórico de acompanhamento.`
        : "O ciclo ainda está reunindo evidências para mostrar um ponto forte com segurança.";

  const attentionSummary = prioritySkill?.skills?.name
    ? `${prioritySkill.skills.name} aparece como prioridade de prática com evidências suficientes para acompanhamento.`
    : "Nenhuma habilidade com evidências suficientes está sinalizada como prioridade neste momento.";

  const nextStepSummary = prioritySkill?.skills?.name
    ? `Continuar praticando ${prioritySkill.skills.name}, acompanhando novas evidências antes de considerar a habilidade consolidada.`
    : nextAssessment?.assessments?.title
      ? `Preparar a próxima avaliação: ${nextAssessment.assessments.title}.`
      : currentContent?.contents?.name
        ? `Dar continuidade ao conteúdo atual: ${currentContent.contents.name}.`
        : "Manter a rotina de atividades e aguardar novas evidências do acompanhamento.";

  return <>
    <PageHeader eyebrow="Ninho da Família" title={`Progresso de ${selectedChild.student_name}`} description="Uma visão direta do que já avançou, do que merece atenção e do próximo passo." />

    <section className="panel family-highlight">
      <div className="panel-head"><div><h2>Resumo do acompanhamento</h2><p>Leitura objetiva dos registros disponíveis no portal. Não substitui a devolutiva pedagógica do professor.</p></div></div>
      <div className="family-dashboard-grid">
        <article className="family-summary-card"><Badge tone="green">Está indo bem</Badge><h3>Força atual</h3><p>{positiveSummary}</p></article>
        <article className="family-summary-card"><Badge tone="yellow">Merece atenção</Badge><h3>Prioridade</h3><p>{attentionSummary}</p></article>
        <article className="family-summary-card"><Badge tone="blue">Próximo passo</Badge><h3>Agora</h3><p>{nextStepSummary}</p></article>
      </div>
    </section>

    <div className="family-dashboard-grid">
      <article className="family-summary-card"><Badge tone="green">Concluídas</Badge><h3>{concluded}</h3><p>Missões e atividades do Caderno já finalizadas.</p></article>
      <article className="family-summary-card"><Badge tone="blue">Aproveitamento</Badge><h3>{scores.length ? percent(achievement) : "—"}</h3><p>Média das atividades e avaliações com nota disponível.</p></article>
      <article className="family-summary-card"><Badge tone="purple">Dias ativos</Badge><h3>{activeDays.size}</h3><p>{activeDays.size === 1 ? "1 dia com atividade registrada." : `${activeDays.size} dias com atividade registrada.`}</p></article>
    </div>

    <div className="grid-2 mt-16">
      <section className="panel"><div className="panel-head"><div><h2>Evolução por matéria</h2><p>Usa resultados já revisados, sem inventar nota quando ainda não há avaliação.</p></div></div>{subjectEvolution.length ? <div className="form-stack">{subjectEvolution.map((subject) => <div className="teacher-progress-row" key={subject.name}><div className="flex space-between gap-8"><strong>{subject.name}</strong><span>{percent(subject.score)}</span></div><div className="teacher-progress-track"><span style={{ width: percent(subject.score) }} /></div></div>)}</div> : <EmptyState title="Ainda sem resultados por matéria" description="A evolução aparece quando houver atividades corrigidas ou avaliações com nota." />}</section>
      <section className="panel"><div className="panel-head"><div><h2>Habilidades dominadas</h2><p>{improving} habilidade(s) mostram evolução recente.</p></div></div>{mastered.length ? <div className="flex gap-8 wrap">{mastered.slice(0,20).map((state:any,index:number)=><Badge tone="green" key={`${state.skills?.name}-${index}`}>{state.skills?.name || "Habilidade"}</Badge>)}</div> : <EmptyState title="O ciclo ainda está começando" description="Uma habilidade só aparece como consolidada depois de evidências suficientes." />}</section>
    </div>

    <div className="grid-2">
      <section className="panel family-highlight"><div className="panel-head"><div><h2>Conteúdo para reforçar</h2><p>Prioridades observadas no acompanhamento.</p></div></div>{reinforce.length ? <div className="form-stack">{reinforce.slice(0,12).map((state:any,index:number)=><article className="family-upload-row" key={`${state.skills?.name}-${index}`}><div><strong>{state.skills?.name || "Habilidade"}</strong><small>{state.trend === "improving" ? "Está evoluindo, mas ainda precisa de treino." : "Precisa de novas oportunidades de prática."}</small></div><Badge tone="yellow">Em desenvolvimento</Badge></article>)}</div> : <p className="muted">Nenhum reforço específico sinalizado no momento.</p>}{contentRows.length ? <div className="mt-16"><strong>Estudando agora</strong><div className="flex gap-8 wrap mt-8">{contentRows.map((item:any,index:number)=><Badge tone={item.confirmed || item.is_manual ? "blue" : "neutral"} key={`${item.contents?.name}-${index}`}>{item.subjects?.name ? `${item.subjects.name}: ` : ""}{item.contents?.name || "Conteúdo"}</Badge>)}</div></div> : null}</section>
      <section className="panel"><div className="panel-head"><div><h2>Avaliações</h2><p>Resultados disponíveis e próximas avaliações.</p></div></div>{assessmentRows.length ? <div className="form-stack">{assessmentRows.slice(0,12).map((item:any,index:number)=><article className="family-upload-row" key={`${item.assessments?.title}-${index}`}><div><strong>{item.assessments?.title || "Avaliação"}</strong><small>{item.assessments?.subjects?.name || "Matéria"}{item.assessments?.scheduled_for ? ` · ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Bahia" }).format(new Date(item.assessments.scheduled_for))}` : ""}</small></div>{item.score != null ? <Badge tone="green">{item.score}</Badge> : <Badge tone="yellow">{item.status === "assigned" ? "Próxima" : item.status}</Badge>}</article>)}</div> : <EmptyState title="Nenhuma avaliação registrada" description="As avaliações aparecerão aqui quando forem cadastradas." />}</section>
    </div>
  </>;
}
