import Link from "next/link";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { getCurrentTeacher } from "@/lib/teacher";

const PAGE_SIZE = 24;

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bahia" }).format(new Date(value));
}

function pageNumber(value?: string) {
  const parsed = Number(value || 1);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function TeacherStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const query = await searchParams;
  const requestedPage = pageNumber(query.pagina);
  const from = (requestedPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) return <EmptyState title="Perfil incompleto" description="A administração precisa concluir seu perfil de professor." />;

  const { data: links, count } = await supabase
    .from("teacher_students")
    .select("student_id,students!inner(id,preferred_name,full_name,school_name,status,deleted_at,grades(name))", { count: "exact" })
    .eq("teacher_id", teacher.id)
    .eq("active", true)
    .is("students.deleted_at", null)
    .neq("students.status", "inactive")
    .order("created_at", { ascending: false })
    .range(from, to);

  const visible = links ?? [];
  const studentIds = visible.map((link: any) => link.student_id);

  const [
    { data: currentContents },
    { data: skillStates },
    { data: missionRows },
    { data: notebookRows },
    { data: events },
    { data: gameProfiles },
  ] = studentIds.length ? await Promise.all([
    supabase.from("student_current_contents").select("student_id,subjects(name)").in("student_id", studentIds).eq("active", true),
    supabase.from("student_skill_states").select("student_id,domain_level,manual_domain_level,evidence_count").in("student_id", studentIds),
    supabase.from("mission_students").select("student_id,status,due_at").eq("assigned_by_teacher_id", teacher.id).in("student_id", studentIds).in("status", ["assigned", "in_progress", "submitted"]),
    supabase.from("notebook_assignments").select("student_id,status,due_at").eq("assigned_by_teacher_id", teacher.id).in("student_id", studentIds).in("status", ["assigned", "in_progress", "submitted"]),
    supabase
      .from("agenda_events")
      .select("id,title,starts_at,event_type,status,agenda_event_students!inner(student_id)")
      .eq("created_by_teacher_id", teacher.id)
      .in("agenda_event_students.student_id", studentIds)
      .gte("starts_at", new Date().toISOString())
      .neq("status", "cancelled")
      .order("starts_at")
      .limit(PAGE_SIZE * 4),
    supabase.from("student_game_profiles").select("student_id,avatar_character_id,characters(name,assets)").in("student_id", studentIds),
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }] as any;

  const subjectsByStudent = new Map<string, Set<string>>();
  for (const row of currentContents ?? []) {
    const set = subjectsByStudent.get(row.student_id) ?? new Set<string>();
    if (row.subjects?.name) set.add(row.subjects.name);
    subjectsByStudent.set(row.student_id, set);
  }

  const statesByStudent = new Map<string, any[]>();
  for (const state of skillStates ?? []) {
    const list = statesByStudent.get(state.student_id) ?? [];
    list.push(state);
    statesByStudent.set(state.student_id, list);
  }

  const pendingByStudent = new Map<string, number>();
  for (const row of [...(missionRows ?? []), ...(notebookRows ?? [])]) {
    pendingByStudent.set(row.student_id, (pendingByStudent.get(row.student_id) || 0) + 1);
  }

  const nextEventByStudent = new Map<string, any>();
  for (const event of events ?? []) {
    for (const link of event.agenda_event_students ?? []) {
      if (!nextEventByStudent.has(link.student_id)) nextEventByStudent.set(link.student_id, event);
    }
  }

  const avatarByStudent = new Map((gameProfiles ?? []).map((row: any) => [row.student_id, row.characters]));
  const total = count ?? visible.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  return (
    <>
      <PageHeader
        eyebrow="Professor • Acompanhamento"
        title="Meus alunos"
        description="Ano, escola, matérias atuais, progresso, pendências e próximo encontro sem precisar abrir cada perfil primeiro."
      />

      {visible.length ? (
        <>
          <div className="teacher-student-grid">
            {visible.map((link: any) => {
              const student = link.students;
              const avatar: any = avatarByStudent.get(link.student_id);
              const avatarPath = avatar?.assets?.avatar || avatar?.assets?.principal || "";
              const subjects = [...(subjectsByStudent.get(link.student_id) || [])];
              const states = (statesByStudent.get(link.student_id) || []).filter((state: any) => state.evidence_count > 0);
              const avg = states.length ? states.reduce((sum: number, state: any) => sum + Number(state.manual_domain_level ?? state.domain_level ?? 0), 0) / states.length : 0;
              const progress = Math.max(0, Math.min(100, Math.round((avg / 4) * 100)));
              const pending = pendingByStudent.get(link.student_id) || 0;
              const nextEvent = nextEventByStudent.get(link.student_id);

              return (
                <Link className="teacher-student-card" href={`/professor/alunos/${link.student_id}`} key={link.student_id}>
                  <div className="teacher-student-head">
                    <div className="teacher-student-avatar">
                      {avatarPath ? <img src={avatarPath} alt="" loading="lazy" decoding="async" /> : <span>{String(student.preferred_name || student.full_name || "A").slice(0,1).toUpperCase()}</span>}
                    </div>
                    <div>
                      <h3>{student.preferred_name || student.full_name}</h3>
                      <p>{student.grades?.name || "Ano não informado"} · {student.school_name || "Escola não informada"}</p>
                    </div>
                  </div>

                  <div className="teacher-student-meta">
                    {subjects.length ? subjects.slice(0, 4).map((subject) => <Badge tone="blue" key={subject}>{subject}</Badge>) : <Badge tone="neutral">Matérias a confirmar</Badge>}
                    {pending > 0 && <Badge tone="yellow">{pending} pendência{pending === 1 ? "" : "s"}</Badge>}
                  </div>

                  <div className="teacher-student-progress">
                    <div className="teacher-progress-label"><span>Progresso observado</span><strong>{states.length ? `${progress}%` : "Começando"}</strong></div>
                    <div className="teacher-progress-track"><span style={{ width: `${states.length ? progress : 6}%` }} /></div>
                    <small className="muted">Baseado nas habilidades com evidências registradas, não em uma nota isolada.</small>
                  </div>

                  <div className="teacher-student-footer">
                    <div>
                      <small>Próximo encontro</small>
                      <strong>{nextEvent ? dt(nextEvent.starts_at) : "Nenhum marcado"}</strong>
                    </div>
                    <span>Ver aluno →</span>
                  </div>
                </Link>
              );
            })}
          </div>

          {totalPages > 1 && (
            <nav className="flex gap-8 wrap align-center space-between mt-16" aria-label="Paginação dos alunos">
              <small className="muted">Página {page} de {totalPages} · {total} aluno{total === 1 ? "" : "s"}</small>
              <div className="flex gap-8 wrap">
                {page > 1 && <Link className="button button-secondary button-small" href={`/professor/alunos?pagina=${page - 1}`}>← Anterior</Link>}
                {page < totalPages && <Link className="button button-secondary button-small" href={`/professor/alunos?pagina=${page + 1}`}>Próxima →</Link>}
              </div>
            </nav>
          )}
        </>
      ) : <EmptyState title="Nenhum aluno vinculado" description="Seus alunos aparecerão aqui após a administração concluir os vínculos." />}
    </>
  );
}
