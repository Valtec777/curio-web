import Link from "next/link";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { enterStudentSpace } from "@/app/familia/access-actions";
import { getFamilyPortal } from "@/lib/family";

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bahia",
  }).format(new Date(value));
}

function childHref(path: string, studentId: string) {
  return `${path}?aluno=${encodeURIComponent(studentId)}`;
}

export default async function FamilyPage({
  searchParams,
}: {
  searchParams: Promise<{ aluno?: string; erro?: string; sucesso?: string }>;
}) {
  const query = await searchParams;
  const { children, selectedChild, supabase } = await getFamilyPortal(query.aluno || null);

  if (!children.length || !selectedChild) {
    return (
      <>
        <PageHeader
          eyebrow="Ninho da Família"
          title="Acompanhando"
          description="Uma visão acolhedora e objetiva da jornada escolar."
        />
        <EmptyState
          title="Nenhuma criança vinculada"
          description="A administração precisa aprovar o vínculo da família com a criança."
        />
      </>
    );
  }

  const studentId = selectedChild.student_id;
  const now = new Date();
  const nowIso = now.toISOString();

  const [
    { data: missions },
    { data: notebooks },
    { data: assessments },
    { data: eventLinks },
    { data: states },
    { data: currentContents },
  ] = await Promise.all([
    supabase
      .from("mission_students")
      .select("id,status,due_at,missions(title)")
      .eq("student_id", studentId)
      .in("status", ["assigned", "in_progress"])
      .order("assigned_at", { ascending: false })
      .limit(50),
    supabase
      .from("notebook_assignments")
      .select("id,status,due_at,teacher_note,score,needs_redo,redo_note,notebook_activities(title)")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("assessment_students")
      .select("id,status,score,assessments(title,scheduled_for,subjects(name))")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("agenda_event_students")
      .select("event_id,agenda_events(id,title,event_type,starts_at,ends_at,status,meeting_url,visible_to_guardian)")
      .eq("student_id", studentId)
      .limit(40),
    selectedChild.can_view_progress
      ? supabase
          .from("student_skill_states")
          .select("domain_level,evidence_count,trend")
          .eq("student_id", studentId)
          .limit(100)
      : Promise.resolve({ data: [] as any[] }),
    supabase
      .from("student_current_contents")
      .select("id,confirmed,is_manual,subjects(name),contents(name)")
      .eq("student_id", studentId)
      .eq("active", true)
      .limit(3),
  ]);

  const missionRows = (missions ?? []) as any[];
  const notebookRows = (notebooks ?? []) as any[];
  const assessmentRows = (assessments ?? []) as any[];
  const eventRows = (eventLinks ?? []) as any[];
  const stateRows = (states ?? []) as any[];
  const contentRows = (currentContents ?? []) as any[];

  const overdueMissions = missionRows.filter(
    (item) => item.due_at && new Date(item.due_at) < now,
  );
  const attentionNotebooks = notebookRows.filter(
    (item) =>
      item.needs_redo ||
      (["assigned", "in_progress"].includes(String(item.status)) && item.due_at && new Date(item.due_at) < now),
  );
  const redoActivities = attentionNotebooks.filter((item) => item.needs_redo);
  const overdueNotebookOnly = attentionNotebooks.filter(
    (item) => !item.needs_redo && item.due_at && new Date(item.due_at) < now,
  );
  const alertCount = overdueMissions.length + attentionNotebooks.length;

  const attentionSummary = [
    overdueMissions.length
      ? `${overdueMissions.length} ${overdueMissions.length === 1 ? "missão com prazo vencido" : "missões com prazo vencido"}.`
      : null,
    redoActivities.length
      ? `${redoActivities.length} ${redoActivities.length === 1 ? "atividade para refazer" : "atividades para refazer"}.`
      : null,
    overdueNotebookOnly.length
      ? `${overdueNotebookOnly.length} ${overdueNotebookOnly.length === 1 ? "atividade do caderno atrasada" : "atividades do caderno atrasadas"}.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  const futureAssessments = assessmentRows
    .filter(
      (item) => item.assessments?.scheduled_for && new Date(item.assessments.scheduled_for) >= now,
    )
    .sort(
      (a, b) =>
        +new Date(a.assessments.scheduled_for) - +new Date(b.assessments.scheduled_for),
    );
  const nextAssessment = futureAssessments[0] || null;

  const futureEvents = eventRows
    .filter(
      (item) =>
        item.agenda_events?.visible_to_guardian &&
        item.agenda_events?.status !== "cancelled" &&
        item.agenda_events?.starts_at &&
        item.agenda_events.starts_at >= nowIso,
    )
    .sort(
      (a, b) =>
        +new Date(a.agenda_events.starts_at) - +new Date(b.agenda_events.starts_at),
    );
  const nextEvent: any = futureEvents[0]?.agenda_events || null;

  const reviewedNotebooks = notebookRows.filter(
    (item) => item.teacher_note || item.score != null,
  );
  const recentFeedback = reviewedNotebooks[0] || null;
  const evidencedStates = stateRows.filter(
    (state) => Number(state.evidence_count || 0) > 0,
  );
  const currentContent = contentRows[0] || null;

  return (
    <>
      <PageHeader
        eyebrow="Ninho da Família"
        title={`Acompanhando ${selectedChild.student_name}`}
        description="Veja primeiro o que precisa de atenção, depois o próximo compromisso e como o acompanhamento está avançando."
      />

      {query.erro ? <div className="form-message form-error">{query.erro}</div> : null}
      {query.sucesso ? <div className="form-message form-success">{query.sucesso}</div> : null}

      <section className="family-overview-hero">
        <div>
          <Badge tone={selectedChild.student_status === "active" ? "green" : "neutral"}>
            {selectedChild.student_status === "active" ? "Acompanhamento ativo" : selectedChild.student_status}
          </Badge>
          <h2>{selectedChild.student_name}</h2>
          <p>
            {selectedChild.grade_name || "Ano escolar não informado"}
            {selectedChild.school_name ? ` · ${selectedChild.school_name}` : ""}
          </p>
          <div className="family-overview-meta">
            <Badge tone="blue">Professor(a): {selectedChild.teacher_name || "A definir"}</Badge>
            {(selectedChild.tracked_subjects ?? []).map((subject) => (
              <Badge tone="purple" key={subject}>{subject}</Badge>
            ))}
          </div>
          <div className="flex gap-8 wrap mt-16">
            <Link
              className="button button-secondary button-small"
              href={childHref("/familia/progresso", studentId)}
            >
              Ver acompanhamento
            </Link>
            <form action={enterStudentSpace}>
              <input type="hidden" name="studentId" value={studentId} />
              <button className="button button-primary button-small" type="submit">
                Entrar no espaço da criança
              </button>
            </form>
          </div>
        </div>

        <article className="family-summary-card">
          <Badge tone={alertCount ? "yellow" : "green"}>
            {alertCount ? "Precisa de atenção" : "Tudo certo por aqui"}
          </Badge>
          <h3>
            {alertCount
              ? `${alertCount} ${alertCount === 1 ? "item precisa" : "itens precisam"} de atenção`
              : "Nenhuma pendência importante agora"}
          </h3>
          <p>{alertCount ? attentionSummary : "As atividades com prazo e devoluções estão em dia neste momento."}</p>
          {alertCount ? (
            <Link
              className="button button-primary button-small mt-12"
              href={childHref("/familia/atividades", studentId)}
            >
              Ver o que precisa fazer
            </Link>
          ) : (
            <Link
              className="button button-secondary button-small mt-12"
              href={childHref("/familia/atividades", studentId)}
            >
              Ver atividades
            </Link>
          )}
        </article>
      </section>

      <div className="grid-2">
        <article className="family-summary-card">
          <Badge tone="blue">Próximo encontro</Badge>
          <h3>{nextEvent?.title || "Nenhum encontro marcado"}</h3>
          <p>{nextEvent ? dt(nextEvent.starts_at) : "Quando o professor agendar, o próximo encontro aparecerá aqui."}</p>
          <div className="flex gap-8 wrap mt-12">
            <Link
              className="button button-secondary button-small"
              href={childHref("/familia/agenda", studentId)}
            >
              Ver agenda
            </Link>
            {nextEvent?.meeting_url ? (
              <a
                className="button button-primary button-small"
                href={nextEvent.meeting_url}
                target="_blank"
                rel="noreferrer"
              >
                Entrar no encontro
              </a>
            ) : null}
          </div>
        </article>

        <article className="family-summary-card">
          <Badge tone="pink">Como está indo</Badge>
          <h3>
            {selectedChild.can_view_progress
              ? evidencedStates.length
                ? `${evidencedStates.length} ${evidencedStates.length === 1 ? "habilidade acompanhada" : "habilidades acompanhadas"}`
                : "Acompanhamento em construção"
              : "Acompanhamento disponível conforme as permissões"}
          </h3>
          <p>
            {recentFeedback?.teacher_note
              ? `Devolutiva recente: ${recentFeedback.teacher_note}`
              : selectedChild.can_view_progress
                ? "As evidências registradas ao longo das atividades aparecem no acompanhamento pedagógico."
                : "O detalhamento pedagógico desta criança está restrito pelas permissões atuais."}
          </p>
          {selectedChild.can_view_progress ? (
            <Link
              className="button button-secondary button-small mt-12"
              href={childHref("/familia/progresso", studentId)}
            >
              Abrir acompanhamento
            </Link>
          ) : null}
        </article>
      </div>

      <div className="grid-2 mt-16">
        <article className="family-summary-card">
          <Badge tone="purple">Próxima avaliação</Badge>
          <h3>{nextAssessment?.assessments?.title || "Nenhuma avaliação próxima"}</h3>
          <p>
            {nextAssessment?.assessments?.scheduled_for
              ? `${nextAssessment.assessments.subjects?.name || "Avaliação"} · ${dt(nextAssessment.assessments.scheduled_for)}`
              : "Quando houver uma prova ou avaliação cadastrada, ela aparecerá aqui."}
          </p>
          <Link
            className="button button-secondary button-small mt-12"
            href={childHref("/familia/avaliacoes", studentId)}
          >
            Abrir avaliações
          </Link>
        </article>

        <article className="family-summary-card">
          <Badge tone="blue">Estudando agora</Badge>
          <h3>{currentContent?.contents?.name || "Conteúdo em atualização"}</h3>
          <p>{currentContent?.subjects?.name || "O conteúdo atual aparecerá conforme o acompanhamento avançar."}</p>
          <Link
            className="button button-secondary button-small mt-12"
            href={childHref("/familia/conteudos", studentId)}
          >
            Ver conteúdo da escola
          </Link>
        </article>
      </div>
    </>
  );
}
