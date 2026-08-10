import Link from "next/link";
import { getCurrentTeacher } from "@/lib/teacher";
import { Badge, EmptyState, PageHeader } from "@/components/ui";

function dayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bahia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bahia",
  }).format(new Date(value));
}

function time(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bahia",
  }).format(new Date(value));
}

function eventLabel(type?: string | null) {
  if (type === "class") return "Aula";
  if (type === "review") return "Revisão";
  if (type === "family_meeting" || type === "meeting") return "Reunião com família";
  if (type === "assessment") return "Avaliação";
  return "Encontro";
}

export default async function TeacherHome() {
  const { teacher, supabase, viewer } = await getCurrentTeacher();

  if (!teacher) {
    return (
      <EmptyState
        title="Perfil de professor ainda não vinculado"
        description="A administração precisa concluir seu vínculo antes de você começar a usar o Portal do Professor."
      />
    );
  }

  const today = dayKey();
  const todayStart = `${today}T00:00:00-03:00`;
  const todayEnd = `${today}T23:59:59-03:00`;
  const nowIso = new Date().toISOString();
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);

  const { data: studentLinks } = await supabase
    .from("teacher_students")
    .select("student_id,students(id,preferred_name,full_name,deleted_at,status)")
    .eq("teacher_id", teacher.id)
    .eq("active", true);

  const activeLinks = (studentLinks ?? []).filter((link: any) => link.students && !link.students.deleted_at && link.students.status === "active");
  const studentIds = activeLinks.map((link: any) => link.student_id);

  const [
    { data: todayEvents },
    { data: upcomingEvents },
    { count: missionPending },
    { count: notebookPending },
    { count: waitingMission },
    { count: upcomingAssessments },
    { data: recentMaterials },
    { data: recentNotebooks },
    { data: participantRows },
  ] = await Promise.all([
    supabase
      .from("agenda_events")
      .select("id,title,event_type,starts_at,ends_at,status,meeting_url,agenda_event_students(student_id,students(preferred_name,full_name))")
      .eq("created_by_teacher_id", teacher.id)
      .gte("starts_at", todayStart)
      .lte("starts_at", todayEnd)
      .neq("status", "cancelled")
      .order("starts_at"),
    supabase
      .from("agenda_events")
      .select("id,title,event_type,starts_at,ends_at,status,meeting_url,agenda_event_students(student_id,students(preferred_name,full_name))")
      .eq("created_by_teacher_id", teacher.id)
      .gte("starts_at", nowIso)
      .neq("status", "cancelled")
      .order("starts_at")
      .limit(8),
    studentIds.length
      ? supabase.from("submissions").select("id", { count: "exact", head: true }).in("student_id", studentIds).eq("review_status", "pending")
      : Promise.resolve({ count: 0 } as any),
    studentIds.length
      ? supabase.from("notebook_assignments").select("id", { count: "exact", head: true }).in("student_id", studentIds).eq("status", "submitted")
      : Promise.resolve({ count: 0 } as any),
    studentIds.length
      ? supabase.from("mission_students").select("id", { count: "exact", head: true }).eq("assigned_by_teacher_id", teacher.id).in("student_id", studentIds).in("status", ["assigned", "in_progress"])
      : Promise.resolve({ count: 0 } as any),
    supabase
      .from("assessments")
      .select("id", { count: "exact", head: true })
      .eq("created_by_teacher_id", teacher.id)
      .gte("scheduled_for", nowIso)
      .lte("scheduled_for", nextWeek.toISOString())
      .neq("status", "archived"),
    supabase
      .from("materials")
      .select("id,title,material_type,status,created_at,subjects(name)")
      .eq("created_by_teacher_id", teacher.id)
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("notebook_activities")
      .select("id,title,status,created_at,subjects(name)")
      .eq("created_by_teacher_id", teacher.id)
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("message_thread_participants")
      .select("thread_id,last_read_at")
      .eq("user_id", viewer.user.id)
      .limit(80),
  ]);

  const threadIds = (participantRows ?? []).map((item: any) => item.thread_id);
  const { data: incomingMessages } = threadIds.length
    ? await supabase
        .from("messages")
        .select("id,thread_id,created_at,sender_user_id")
        .in("thread_id", threadIds)
        .neq("sender_user_id", viewer.user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: [] as any[] };

  const lastReadByThread = new Map((participantRows ?? []).map((item: any) => [item.thread_id, item.last_read_at ? new Date(item.last_read_at).getTime() : 0]));
  const unreadMessages = (incomingMessages ?? []).filter((message: any) => new Date(message.created_at).getTime() > (lastReadByThread.get(message.thread_id) || 0)).length;
  const todayClasses = (todayEvents ?? []).filter((event: any) => ["class", "review"].includes(event.event_type));
  const correctionCount = (missionPending ?? 0) + (notebookPending ?? 0);
  const nextEvent = upcomingEvents?.[0];

  const recentItems = [
    ...(recentMaterials ?? []).map((item: any) => ({ ...item, kind: item.material_type === "pdf" ? "PDF" : "Material" })),
    ...(recentNotebooks ?? []).map((item: any) => ({ ...item, kind: "Caderno Curió" })),
  ]
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const firstName = viewer.profile?.preferred_name || viewer.profile?.full_name || "professor(a)";

  return (
    <>
      <PageHeader
        eyebrow="Professor • Hoje"
        title={`Hoje no CURIÓ, ${firstName}`}
        description="Tudo que merece sua atenção agora, sem precisar abrir cinco telas antes de começar."
        action={<Link className="button button-primary" href="/professor/criar">+ Criar conteúdo</Link>}
      />

      <section className="teacher-today-card">
        <div>
          <Badge tone="blue">Visão do dia</Badge>
          <h2>Seu trabalho de hoje, numa única leitura.</h2>
          <p>Alunos, encontros, correções, mensagens e próximos prazos ficam juntos aqui.</p>
        </div>

        <div className="teacher-metric-grid" aria-label="Resumo do professor">
          <div className="teacher-metric"><strong>{activeLinks.length}</strong><span>Alunos ativos</span></div>
          <div className="teacher-metric"><strong>{todayClasses.length}</strong><span>Aulas hoje</span></div>
          <div className="teacher-metric"><strong>{correctionCount}</strong><span>Correções pendentes</span></div>
          <div className="teacher-metric"><strong>{unreadMessages}</strong><span>Mensagens não lidas</span></div>
          <div className="teacher-metric"><strong>{waitingMission ?? 0}</strong><span>Aguardando aluno</span></div>
          <div className="teacher-metric"><strong>{upcomingAssessments ?? 0}</strong><span>Avaliações próximas</span></div>
        </div>

        <div className="teacher-quick-actions">
          <Link className="teacher-quick-action" href="/professor/criar?modo=missao"><span>Nova missão</span><b>＋</b></Link>
          <Link className="teacher-quick-action" href="/professor/criar?modo=material"><span>Novo material</span><b>＋</b></Link>
          <Link className="teacher-quick-action" href="/professor/criar?modo=avaliacao"><span>Nova avaliação</span><b>＋</b></Link>
          <Link className="teacher-quick-action" href="/professor/agenda#novo"><span>Agendar encontro</span><b>＋</b></Link>
        </div>
      </section>

      <div className="teacher-today-grid mt-12">
        <section className="teacher-today-card">
          <div className="flex space-between gap-8 wrap">
            <div><h2>Aulas de hoje</h2><p>O link fica no compromisso para entrar sem procurar em mensagem antiga.</p></div>
            <Link href="/professor/agenda">Abrir agenda →</Link>
          </div>
          {todayEvents?.length ? (
            <div className="teacher-agenda-list">
              {todayEvents.map((event: any) => {
                const student = event.agenda_event_students?.[0]?.students;
                return (
                  <article className="teacher-agenda-item" key={event.id}>
                    <div>
                      <strong>{time(event.starts_at)} · {event.title}</strong>
                      <small>{eventLabel(event.event_type)} · {student?.preferred_name || student?.full_name || "Aluno"} · {event.status === "confirmed" ? "confirmado" : "agendado"}</small>
                    </div>
                    {event.meeting_url ? (
                      <a className="button button-primary button-small teacher-join-link" href={event.meeting_url} target="_blank" rel="noreferrer">Entrar ↗</a>
                    ) : <Badge tone="neutral">Sem link</Badge>}
                  </article>
                );
              })}
            </div>
          ) : <EmptyState title="Sem encontro hoje" description="Quando houver aula, revisão ou reunião marcada, ela aparecerá aqui com o horário e o link." />}
        </section>

        <aside className="teacher-side-card">
          <h2>Próximo encontro</h2>
          {nextEvent ? (
            <div className="teacher-recent-list">
              <article className="teacher-recent-item">
                <div>
                  <strong>{nextEvent.title}</strong>
                  <small>{dt(nextEvent.starts_at)} · {eventLabel(nextEvent.event_type)}</small>
                </div>
                {nextEvent.meeting_url && <a href={nextEvent.meeting_url} target="_blank" rel="noreferrer">Abrir ↗</a>}
              </article>
            </div>
          ) : <p>Nenhum encontro futuro cadastrado.</p>}

          <div className="mt-20">
            <h2>Materiais recentes</h2>
            {recentItems.length ? (
              <div className="teacher-recent-list">
                {recentItems.map((item: any) => (
                  <Link className="teacher-recent-item" href="/professor/materiais" key={`${item.kind}-${item.id}`}>
                    <div><strong>{item.title}</strong><small>{item.kind} · {item.subjects?.name || "Geral"}</small></div>
                    <span>→</span>
                  </Link>
                ))}
              </div>
            ) : <p>Nenhum material criado ainda.</p>}
          </div>
        </aside>
      </div>

      <div className="teacher-section-grid">
        <section className="panel">
          <div className="panel-head"><div><h2>Precisa de você</h2><p>O que ainda depende de uma ação humana.</p></div></div>
          <div className="teacher-recent-list">
            <Link className="teacher-recent-item" href="/professor/correcoes"><div><strong>{correctionCount} correção(ões)</strong><small>Missões discursivas e atividades do Caderno enviadas</small></div><span>→</span></Link>
            <Link className="teacher-recent-item" href="/professor/mensagens"><div><strong>{unreadMessages} mensagem(ns) não lida(s)</strong><small>Conversas com responsáveis dos seus alunos</small></div><span>→</span></Link>
            <Link className="teacher-recent-item" href="/professor/missoes"><div><strong>{waitingMission ?? 0} atividade(s) aguardando aluno</strong><small>Publicadas e ainda não finalizadas</small></div><span>→</span></Link>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><div><h2>Próximos passos</h2><p>Atalhos de uso recorrente, sem poluir o topo da página.</p></div></div>
          <div className="teacher-recent-list">
            <Link className="teacher-recent-item" href="/professor/alunos"><div><strong>Meus alunos</strong><small>Progresso, pendências, matérias e próximo encontro</small></div><span>→</span></Link>
            <Link className="teacher-recent-item" href="/professor/conteudos"><div><strong>Biblioteca de conteúdos</strong><small>Reutilize o que você já criou</small></div><span>→</span></Link>
            <Link className="teacher-recent-item" href="/professor/perfil"><div><strong>Minha disponibilidade</strong><small>Atualize dias e horários em que você atende</small></div><span>→</span></Link>
          </div>
        </section>
      </div>
    </>
  );
}
