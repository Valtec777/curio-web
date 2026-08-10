import { randomUUID } from "node:crypto";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { getCurrentTeacher } from "@/lib/teacher";
import { createAgendaEvent, setAgendaEventStatus } from "./actions";
import { AgendaSubmitButton } from "./submit-button";

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bahia",
  }).format(new Date(value));
}

function tone(status?: string | null): "green" | "yellow" | "pink" | "blue" | "neutral" {
  if (status === "completed") return "green";
  if (status === "cancelled") return "pink";
  return "yellow";
}

export default async function ProfessorAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const query = await searchParams;
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) {
    return <EmptyState title="Perfil de professor ainda não vinculado" description="A administração precisa concluir seu perfil antes de criar encontros." />;
  }

  const [{ data: links }, { data: events }, { data: guardianRows }] = await Promise.all([
    supabase
      .from("teacher_students")
      .select("student_id,students(id,preferred_name,full_name,deleted_at)")
      .eq("teacher_id", teacher.id)
      .eq("active", true),
    supabase
      .from("agenda_events")
      .select("id,title,description,event_type,starts_at,ends_at,status,meeting_url,location,visible_to_student,visible_to_guardian,agenda_event_students(student_id,students(preferred_name,full_name))")
      .eq("created_by_teacher_id", teacher.id)
      .order("starts_at", { ascending: false })
      .limit(80),
    supabase.rpc("teacher_linked_guardian_names"),
  ]);

  const students = (links ?? []).filter((link: any) => link.students && !link.students.deleted_at);
  const guardiansByStudent = new Map<string, string[]>();
  for (const row of guardianRows ?? []) {
    const current = guardiansByStudent.get(row.student_id) ?? [];
    current.push(`${row.guardian_name} (${row.relationship})`);
    guardiansByStudent.set(row.student_id, current);
  }
  const idempotencyKey = randomUUID();

  return (
    <>
      <PageHeader
        eyebrow="Professor • Agenda"
        title="Agenda"
        description="Crie aulas e reuniões usando os vínculos reais do aluno. O mesmo evento aparece para quem tiver permissão."
      />

      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Novo encontro</h2>
              <p>O evento é criado uma única vez e vinculado ao aluno por ID.</p>
            </div>
          </div>

          <form action={createAgendaEvent} className="form-stack">
            <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
            <div className="field">
              <label>Aluno *</label>
              <select className="select" name="studentId" required defaultValue="">
                <option value="" disabled>Selecione</option>
                {students.map((link: any) => (
                  <option key={link.student_id} value={link.student_id}>
                    {link.students?.preferred_name || link.students?.full_name || "Aluno"}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="field">
                <label>Tipo *</label>
                <select className="select" name="eventType" defaultValue="class">
                  <option value="class">Aula regular</option>
                  <option value="meeting">Reunião com família</option>
                  <option value="assessment">Avaliação</option>
                  <option value="deadline">Prazo</option>
                  <option value="reminder">Lembrete</option>
                  <option value="other">Outro</option>
                </select>
              </div>
              <div className="field">
                <label>Título *</label>
                <input className="input" name="title" placeholder="Ex.: Reunião de acompanhamento" required />
              </div>
            </div>

            <div className="field">
              <label>Descrição</label>
              <textarea className="textarea" name="description" placeholder="Objetivo, conteúdo ou observações do encontro" />
            </div>

            <div className="form-row">
              <div className="field"><label>Início *</label><input className="input" type="datetime-local" name="startsAt" required /></div>
              <div className="field"><label>Término</label><input className="input" type="datetime-local" name="endsAt" /></div>
            </div>

            <div className="field"><label>Link da aula/reunião</label><input className="input" type="url" name="meetingUrl" placeholder="https://..." /></div>
            <div className="field"><label>Local / observação de acesso</label><input className="input" name="location" placeholder="Online, Sala 2..." /></div>

            <div className="plan-check-row">
              <label><input type="checkbox" name="visibleToStudent" defaultChecked /> Mostrar para o aluno</label>
              <label><input type="checkbox" name="visibleToGuardian" defaultChecked /> Mostrar para a família</label>
            </div>

            <AgendaSubmitButton />
          </form>
        </section>

        <section className="panel">
          <div className="notice">
            Reunião com família usa o vínculo real Família↔Aluno. Para uma reunião somente com responsáveis, desmarque “Mostrar para o aluno”. O Professor recebe apenas nome e tipo de vínculo dos responsáveis dos próprios alunos; nenhum dado de outras famílias é liberado.
          </div>
          {!students.length && <EmptyState title="Nenhum aluno vinculado" description="Vincule um aluno antes de criar um encontro." />}
        </section>
      </div>

      <section className="panel">
        <div className="panel-head"><div><h2>Encontros cadastrados</h2><p>Ações de situação preservam o mesmo evento e os vínculos.</p></div></div>

        {events?.length ? (
          <div className="form-stack">
            {events.map((event: any) => {
              const participantLink = event.agenda_event_students?.[0];
              const participant = participantLink?.students;
              const guardianNames = participantLink?.student_id ? guardiansByStudent.get(participantLink.student_id) ?? [] : [];
              const joinLabel = event.event_type === "meeting" ? "Entrar na reunião ↗" : "Entrar na aula ↗";
              return (
                <article className="mission-card" key={event.id}>
                  <div className="flex space-between gap-8 wrap">
                    <div>
                      <strong>{event.title}</strong>
                      <p>{participant?.preferred_name || participant?.full_name || "Aluno"} • {event.description || event.event_type}</p>
                      {event.event_type === "meeting" && guardianNames.length > 0 && <small className="muted">Responsável(is): {guardianNames.join(", ")}</small>}
                    </div>
                    <Badge tone={tone(event.status)}>{event.status}</Badge>
                  </div>
                  <small className="muted">{dt(event.starts_at)}{event.ends_at ? ` → ${dt(event.ends_at)}` : ""}</small>
                  <div className="flex gap-8 wrap mt-12">
                    {event.visible_to_student && <Badge tone="blue">Aluno</Badge>}
                    {event.visible_to_guardian && <Badge tone="green">Família</Badge>}
                    {event.meeting_url && <a className="button button-secondary button-small" href={event.meeting_url} target="_blank" rel="noreferrer">{joinLabel}</a>}
                  </div>
                  <div className="plan-admin-actions mt-12">
                    {event.status === "scheduled" && <form action={setAgendaEventStatus}><input type="hidden" name="eventId" value={event.id} /><input type="hidden" name="status" value="completed" /><button className="button button-secondary button-small" type="submit">Marcar concluído</button></form>}
                    {event.status !== "cancelled" && <form action={setAgendaEventStatus}><input type="hidden" name="eventId" value={event.id} /><input type="hidden" name="status" value="cancelled" /><button className="button button-ghost button-small" type="submit">Cancelar encontro</button></form>}
                  </div>
                </article>
              );
            })}
          </div>
        ) : <EmptyState title="Agenda livre" description="Crie o primeiro encontro usando o formulário acima." />}
      </section>
    </>
  );
}
