import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { getCurrentTeacher } from "@/lib/teacher";
import { createTeacherMeeting } from "./actions";

function dateTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bahia",
  }).format(new Date(value));
}

export default async function TeacherMeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const query = await searchParams;
  const { teacher, supabase } = await getCurrentTeacher();

  if (!teacher) {
    return <EmptyState title="Perfil de professor não encontrado" description="Peça ao Admin para conferir seu vínculo de professor." />;
  }

  const [{ data: studentLinks }, { data: events }] = await Promise.all([
    supabase
      .from("teacher_students")
      .select("student_id,students(id,full_name,preferred_name)")
      .eq("teacher_id", teacher.id)
      .eq("active", true),
    supabase
      .from("agenda_events")
      .select("id,title,description,starts_at,ends_at,status,meeting_url,visible_to_student,visible_to_guardian")
      .eq("created_by_teacher_id", teacher.id)
      .eq("event_type", "meeting")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(40),
  ]);

  const eventIds = (events ?? []).map((event: any) => event.id);
  const { data: eventStudents } = eventIds.length
    ? await supabase
        .from("agenda_event_students")
        .select("event_id,student_id,students(id,full_name,preferred_name)")
        .in("event_id", eventIds)
    : { data: [] as any[] };

  const studentByEvent = new Map(
    (eventStudents ?? []).map((item: any) => [
      item.event_id,
      item.students?.preferred_name || item.students?.full_name || "Aluno",
    ]),
  );

  return (
    <>
      <PageHeader
        eyebrow="Professor • Reuniões"
        title="Reuniões e Google Meet"
        description="Agende conversas com família, aluno e Administração. O link abre o Google Meet em um clique."
      />

      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <div className="grid-2 meeting-layout">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Agendar reunião</h2>
              <p>Informe o motivo, horário e quem deve visualizar o compromisso.</p>
            </div>
          </div>

          <form action={createTeacherMeeting} className="form-stack">
            <div className="field">
              <label>Motivo / título *</label>
              <input className="input" name="title" required maxLength={160} placeholder="Ex.: Conversa sobre rotina de estudos" />
            </div>

            <div className="field">
              <label>Descrição opcional</label>
              <textarea className="textarea" name="description" placeholder="Pontos que serão conversados, orientações ou observações." />
            </div>

            <div className="field">
              <label>Aluno / contexto da família</label>
              <select className="select" name="studentId" defaultValue="">
                <option value="">Sem aluno específico — reunião com Administração</option>
                {(studentLinks ?? []).map((link: any) => (
                  <option value={link.student_id} key={link.student_id}>
                    {link.students?.preferred_name || link.students?.full_name || "Aluno"}
                  </option>
                ))}
              </select>
              <small className="muted">Para convidar família ou aluno, escolha o aluno correspondente.</small>
            </div>

            <div className="form-row">
              <div className="field">
                <label>Data e hora *</label>
                <input className="input" name="startsAt" type="datetime-local" required />
              </div>
              <div className="field">
                <label>Duração</label>
                <select className="select" name="durationMinutes" defaultValue="30">
                  <option value="15">15 minutos</option>
                  <option value="30">30 minutos</option>
                  <option value="45">45 minutos</option>
                  <option value="60">1 hora</option>
                  <option value="90">1h30</option>
                  <option value="120">2 horas</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label>Link do Google Meet *</label>
              <input className="input" name="meetingUrl" type="url" required placeholder="https://meet.google.com/abc-defg-hij" />
            </div>

            <fieldset className="subject-fieldset">
              <legend>Quem verá a reunião</legend>
              <div className="subject-checks meeting-audience">
                <label><input type="checkbox" checked readOnly /> Administração PLUMARELI</label>
                <label><input type="checkbox" name="visibleToGuardian" defaultChecked /> Família</label>
                <label><input type="checkbox" name="visibleToStudent" /> Aluno</label>
              </div>
              <small className="muted">A Administração sempre pode acompanhar a agenda. Família e aluno só veem quando você marcar.</small>
            </fieldset>

            <button className="button button-primary" type="submit">Agendar reunião</button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Próximas reuniões</h2>
              <p>Abra o Meet diretamente daqui quando chegar o horário.</p>
            </div>
          </div>

          {events?.length ? (
            <div className="form-stack">
              {events.map((event: any) => (
                <article className="mission-card" key={event.id}>
                  <div className="flex space-between gap-8 wrap">
                    <div>
                      <strong>{event.title}</strong>
                      {event.description && <p>{event.description}</p>}
                    </div>
                    <Badge tone="yellow">Agendada</Badge>
                  </div>

                  <small className="muted">
                    {dateTime(event.starts_at)} → {dateTime(event.ends_at)}
                    {studentByEvent.get(event.id) ? ` • ${studentByEvent.get(event.id)}` : " • Administração"}
                  </small>

                  <div className="flex gap-8 wrap mt-12">
                    <Badge tone="blue">Admin</Badge>
                    {event.visible_to_guardian && <Badge tone="green">Família</Badge>}
                    {event.visible_to_student && <Badge tone="purple">Aluno</Badge>}
                  </div>

                  {event.meeting_url && (
                    <p className="mb-0 mt-12">
                      <a className="button button-primary button-small" href={event.meeting_url} target="_blank" rel="noreferrer noopener">
                        Entrar no Google Meet ↗
                      </a>
                    </p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="Nenhuma reunião futura" description="Use o formulário ao lado para agendar a primeira." />
          )}
        </section>
      </div>
    </>
  );
}
