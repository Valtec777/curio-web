import Image from "next/image";
import Link from "next/link";
import { Badge, EmptyState } from "@/components/ui";
import { getCurrentStudent } from "@/lib/student";
import { getSeasonalExperience } from "@/lib/seasonal";

function relation<T = any>(value: any): T | null {
  return (Array.isArray(value) ? value[0] : value) || null;
}

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bahia",
  }).format(new Date(value));
}

export default async function StudentHome() {
  const { student, supabase } = await getCurrentStudent();
  if (!student) {
    return (
      <EmptyState
        title="Seu espaço ainda está sendo preparado"
        description="A administração precisa concluir o vínculo antes de liberar o seu portal."
      />
    );
  }

  const now = new Date();
  const [
    { data: missionRows },
    { data: notebooks },
    { data: game },
    { data: assessments },
    { data: agendaLinks },
  ] = await Promise.all([
    supabase
      .from("mission_students")
      .select("id,due_at,status,progress_percent,assigned_at,missions(title,objective,estimated_minutes,subjects(name))")
      .eq("student_id", student.id)
      .in("status", ["assigned", "in_progress"])
      .order("assigned_at", { ascending: false })
      .limit(40),
    supabase
      .from("notebook_assignments")
      .select("id,status,due_at,needs_redo,notebook_activities(title,description,subjects(name))")
      .eq("student_id", student.id)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("student_game_profiles")
      .select("stars,streak_days,level_name")
      .eq("student_id", student.id)
      .maybeSingle(),
    supabase
      .from("assessment_students")
      .select("id,status,assessments(title,scheduled_for,subjects(name))")
      .eq("student_id", student.id)
      .limit(30),
    supabase
      .from("agenda_event_students")
      .select("event_id,agenda_events(id,title,description,event_type,starts_at,status,meeting_url,location,visible_to_student)")
      .eq("student_id", student.id)
      .limit(40),
  ]);

  const missions = (missionRows ?? []).map((row: any) => ({ ...row, mission: relation(row.missions) }));
  const pendingMissions = missions.filter((row: any) => ["assigned", "in_progress"].includes(row.status));
  const inProgressMission = pendingMissions.find((row: any) => row.status === "in_progress") || null;
  const assignedMission = pendingMissions.find((row: any) => row.status === "assigned") || null;

  const pendingNotebooks = (notebooks ?? []).filter(
    (row: any) => ["assigned", "in_progress"].includes(row.status) || row.needs_redo,
  );
  const redoNotebook = pendingNotebooks.find((row: any) => row.needs_redo) || null;
  const regularNotebook = pendingNotebooks.find((row: any) => !row.needs_redo) || null;

  const upcomingAssessments = (assessments ?? [])
    .map((row: any) => ({ row, assessment: relation(row.assessments) }))
    .filter((item: any) => item.assessment?.scheduled_for && new Date(item.assessment.scheduled_for) >= now)
    .sort((a: any, b: any) => +new Date(a.assessment.scheduled_for) - +new Date(b.assessment.scheduled_for));
  const nextAssessment: any = upcomingAssessments[0]?.assessment || null;

  const events = (agendaLinks ?? [])
    .map((row: any) => relation(row.agenda_events))
    .filter(
      (event: any) =>
        event?.visible_to_student &&
        event.status !== "cancelled" &&
        event.starts_at &&
        new Date(event.starts_at) >= now,
    )
    .sort((a: any, b: any) => +new Date(a.starts_at) - +new Date(b.starts_at));
  const nextEvent: any = events[0] || null;

  const grade: any = relation((student as any).grades);
  const seasonal = getSeasonalExperience(now, grade?.name);

  const focusMission = inProgressMission || (!redoNotebook ? assignedMission : null);
  const focusNotebook = !inProgressMission && redoNotebook ? redoNotebook : !focusMission ? regularNotebook : null;
  const focusAssessment = !focusMission && !focusNotebook ? nextAssessment : null;

  const missionSubject: any = relation(focusMission?.mission?.subjects);
  const notebookActivity: any = relation(focusNotebook?.notebook_activities);
  const notebookSubject: any = relation(notebookActivity?.subjects);

  return (
    <>
      <section className="kid-hero kid-hero-rich student-hero-refresh">
        <div className="kid-hero-copy">
          <div className="eyebrow" style={{ color: "#dfffa8" }}>Portal do Aluno</div>
          <h1>Oi, {student.preferred_name}!</h1>
          <p>Hoje você não precisa decidir entre tudo de uma vez. Comece pelo próximo passo e avance no seu ritmo.</p>
          <div className="student-today-pills" aria-label="Resumo do aluno">
            <span>{grade?.name || "Ano escolar"}</span>
            <span>{game?.stars ?? 0} estrelas</span>
            <span>{game?.streak_days ?? 0} dias seguidos</span>
          </div>
        </div>
        <div className="student-hero-stage" aria-hidden="true">
          <span className="student-hero-orbit student-hero-orbit-one" />
          <span className="student-hero-orbit student-hero-orbit-two" />
          <Image
            className="student-hero-character"
            src="/mascotes/curio_capivara_principal_acolhendo.png"
            alt=""
            width={290}
            height={290}
            priority
          />
        </div>
      </section>

      <section className="panel student-next-event">
        <div className="panel-head">
          <div>
            <div className="eyebrow">Seu próximo passo</div>
            <h2>O que fazer agora</h2>
          </div>
          <Link href="/aluno/missoes">Ver missões</Link>
        </div>

        {focusMission ? (
          <div className="mission-card">
            <div className="flex gap-8 wrap">
              <Badge tone="pink">{missionSubject?.name || "Missão Cuca"}</Badge>
              <Badge tone={focusMission.status === "in_progress" ? "yellow" : "blue"}>
                {focusMission.status === "in_progress" ? "Continue daqui" : "Próxima missão"}
              </Badge>
            </div>
            <h3>{focusMission.mission?.title || "Missão Cuca"}</h3>
            <p>{focusMission.mission?.objective || "Uma nova descoberta está esperando por você."}</p>
            {focusMission.status === "in_progress" ? (
              <div className="progress" aria-label={`Progresso: ${focusMission.progress_percent || 0}%`}>
                <span style={{ width: `${focusMission.progress_percent || 0}%` }} />
              </div>
            ) : null}
            <div className="flex space-between gap-8 wrap mt-12">
              <small className="muted">
                {focusMission.due_at
                  ? `Prazo: ${dt(focusMission.due_at)}`
                  : `${focusMission.mission?.estimated_minutes || 20} min`}
              </small>
              <Link className="button button-primary" href={`/aluno/missoes/${focusMission.id}`}>
                {focusMission.status === "in_progress" ? "Continuar missão" : "Começar missão"}
              </Link>
            </div>
          </div>
        ) : focusNotebook ? (
          <div className="mission-card">
            <div className="flex gap-8 wrap">
              <Badge tone={focusNotebook.needs_redo ? "pink" : "purple"}>
                {focusNotebook.needs_redo ? "Para refazer" : notebookSubject?.name || "Meu Caderno"}
              </Badge>
            </div>
            <h3>{notebookActivity?.title || "Atividade do Caderno"}</h3>
            <p>{
              focusNotebook.needs_redo
                ? "Revise a atividade com calma, faça os ajustes e envie novamente."
                : notebookActivity?.description || "Faça a atividade à mão e envie quando terminar."
            }</p>
            <div className="flex space-between gap-8 wrap mt-12">
              <small className="muted">{focusNotebook.due_at ? `Prazo: ${dt(focusNotebook.due_at)}` : "Sem prazo"}</small>
              <Link className="button button-primary" href="/aluno/caderno">
                Abrir Meu Caderno
              </Link>
            </div>
          </div>
        ) : focusAssessment ? (
          <div className="mission-card">
            <Badge tone="blue">{relation<any>(focusAssessment.subjects)?.name || "Avaliação"}</Badge>
            <h3>{focusAssessment.title}</h3>
            <p>Próxima avaliação em {dt(focusAssessment.scheduled_for)}. Use o Modo Prova para organizar a revisão.</p>
            <Link className="button button-primary mt-12" href="/aluno/modo-prova">
              Abrir Modo Prova
            </Link>
          </div>
        ) : (
          <div className="mission-card">
            <Badge tone="green">Tudo em dia</Badge>
            <h3>Você concluiu o que precisava por agora.</h3>
            <p>Se quiser continuar, explore uma descoberta ou uma trilha do Modo Pensar.</p>
            <div className="flex gap-8 wrap mt-12">
              <Link className="button button-primary" href="/aluno/descobertas">Explorar descobertas</Link>
              <Link className="button button-secondary" href="/aluno/modo-pensar">Abrir Modo Pensar</Link>
            </div>
          </div>
        )}
      </section>

      {nextEvent ? (
        <section className="panel student-next-event">
          <div className="panel-head">
            <div>
              <h2>Próximo encontro</h2>
              <p>{dt(nextEvent.starts_at)}</p>
            </div>
            <Link href="/aluno/agenda">Ver agenda</Link>
          </div>
          <div className="student-inline-event">
            <div>
              <Badge tone="blue">{nextEvent.event_type === "class" ? "Aula" : "Encontro"}</Badge>
              <h3>{nextEvent.title}</h3>
              <p>{nextEvent.description || nextEvent.location || "Encontro Plumareli"}</p>
            </div>
            {nextEvent.meeting_url ? (
              <a className="button button-primary" href={nextEvent.meeting_url} target="_blank" rel="noreferrer">
                Entrar na aula
              </a>
            ) : null}
          </div>
        </section>
      ) : null}

      {(pendingNotebooks.length > 0 || nextAssessment) ? (
        <div className="grid-2">
          {pendingNotebooks.length > 0 && !focusNotebook ? (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Depois: Meu Caderno</h2>
                  <p>{pendingNotebooks.length} {pendingNotebooks.length === 1 ? "atividade pendente" : "atividades pendentes"}.</p>
                </div>
                <Link href="/aluno/caderno">Abrir caderno</Link>
              </div>
              <p className="muted">Atividades para fazer à mão e enviar quando terminar.</p>
            </section>
          ) : null}

          {nextAssessment && !focusAssessment ? (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Próxima avaliação</h2>
                  <p>{dt(nextAssessment.scheduled_for)}</p>
                </div>
                <Link href="/aluno/modo-prova">Modo Prova</Link>
              </div>
              <div className="mission-card">
                <Badge tone="blue">{relation<any>(nextAssessment.subjects)?.name || "Avaliação"}</Badge>
                <h3>{nextAssessment.title}</h3>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {seasonal ? (
        <section className={`panel seasonal-mission seasonal-${seasonal.slug}`} data-decor={seasonal.decorations[0]}>
          <div className="panel-head">
            <div>
              <div className="eyebrow">{seasonal.eyebrow} · opcional</div>
              <h2>{seasonal.title}</h2>
            </div>
          </div>
          <p>{seasonal.missionText}</p>
          <span className="seasonal-note">Conteúdo editorial PLUMARELI · não publica uma missão em nome do professor.</span>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Quer explorar mais?</h2>
            <p>Essas áreas continuam disponíveis quando você quiser ir além do próximo passo.</p>
          </div>
        </div>
        <div className="flex gap-8 wrap">
          <Link className="button button-secondary" href="/aluno/caminho">Meu Caminho</Link>
          <Link className="button button-secondary" href="/aluno/conquistas">Conquistas</Link>
          <Link className="button button-secondary" href="/aluno/modo-pensar">Modo Pensar</Link>
        </div>
      </section>
    </>
  );
}
