import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { getFamilyPortal } from "@/lib/family";
import { respondToAgendaEvent } from "./actions";

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bahia",
  }).format(new Date(value));
}

function tone(status?: string | null): "green" | "yellow" | "pink" | "blue" | "neutral" {
  if (status === "completed" || status === "confirmed") return "green";
  if (status === "cancelled") return "pink";
  return "yellow";
}

function statusLabel(status?: string | null) {
  if (status === "confirmed") return "Confirmado";
  if (status === "completed") return "Realizado";
  if (status === "cancelled") return "Cancelado";
  return "Agendado";
}

function eventLabel(type?: string | null) {
  if (type === "class") return "Aula";
  if (type === "review") return "Revisão";
  if (type === "family_meeting" || type === "meeting") return "Reunião com a família";
  if (type === "assessment") return "Avaliação";
  return "Outro";
}

function responseLabel(response?: string | null) {
  if (response === "confirmed") return "Presença confirmada";
  if (response === "unavailable") return "Não poderá comparecer";
  return null;
}

export default async function FamilyAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ aluno?: string; erro?: string; sucesso?: string }>;
}) {
  const query = await searchParams;
  const { selectedChild, supabase, viewer } = await getFamilyPortal(query.aluno || null);
  if (!selectedChild) return <EmptyState title="Nenhuma criança vinculada" description="A agenda aparecerá quando houver uma criança vinculada." />;

  const guardianName = viewer.profile?.preferred_name || viewer.profile?.full_name || "Responsável";
  const [{ data: eventLinks }, { data: responseRows }] = await Promise.all([
    supabase
      .from("agenda_event_students")
      .select("student_id,event_id,agenda_events(id,title,description,event_type,starts_at,ends_at,status,location,meeting_url,visible_to_guardian)")
      .eq("student_id", selectedChild.student_id)
      .limit(100),
    supabase
      .from("agenda_event_guardian_responses")
      .select("event_id,response,note,responded_at")
      .eq("student_id", selectedChild.student_id)
      .order("responded_at", { ascending: false })
      .limit(100),
  ]);

  const responseByEvent = new Map<string, any>();
  for (const row of responseRows ?? []) {
    if (!responseByEvent.has(row.event_id)) responseByEvent.set(row.event_id, row);
  }

  const events = (eventLinks ?? [])
    .filter((item: any) => item.agenda_events?.visible_to_guardian)
    .filter((item: any) => new Date(item.agenda_events.starts_at).getTime() >= Date.now() - 6 * 60 * 60 * 1000)
    .sort((a: any, b: any) => +new Date(a.agenda_events.starts_at) - +new Date(b.agenda_events.starts_at));

  return (
    <>
      <PageHeader
        eyebrow="Ninho da Família"
        title={`Agenda de ${selectedChild.student_name}`}
        description="Aulas, revisões, reuniões com a família e outros compromissos marcados pelo professor."
      />
      {query.erro ? <div className="form-message form-error">{query.erro}</div> : null}
      {query.sucesso ? <div className="form-message form-success">{query.sucesso}</div> : null}

      <section className="panel">
        {events.length ? (
          <div className="form-stack">
            {events.map((item: any) => {
              const event = item.agenda_events;
              const isFamilyMeeting = event.event_type === "meeting" || event.event_type === "family_meeting";
              const response = responseByEvent.get(event.id);
              const canRespond = isFamilyMeeting && ["scheduled", "confirmed"].includes(event.status);
              const savedResponseLabel = responseLabel(response?.response);
              return (
                <article className="family-upload-card" key={`${item.student_id}-${item.event_id}`}>
                  <div className="flex space-between gap-8 wrap">
                    <div>
                      <div className="flex gap-8 wrap">
                        <Badge tone="blue">{eventLabel(event.event_type)}</Badge>
                        <Badge tone={tone(event.status)}>{statusLabel(event.status)}</Badge>
                        {savedResponseLabel ? <Badge tone={response.response === "confirmed" ? "green" : "pink"}>{savedResponseLabel}</Badge> : null}
                      </div>
                      <h3>{event.title}</h3>
                      <p>{event.description || eventLabel(event.event_type)}</p>
                      {isFamilyMeeting ? <small className="muted">Responsável: {guardianName}</small> : null}
                    </div>
                  </div>
                  <div className="teacher-resource-meta">
                    <span>{dt(event.starts_at)}{event.ends_at ? ` → ${dt(event.ends_at)}` : ""}</span>
                    {event.location ? <span>• {event.location}</span> : null}
                  </div>
                  {response?.note ? <div className="family-highlight mt-12"><strong>Observação registrada</strong><p>{response.note}</p></div> : null}
                  {event.meeting_url && event.status !== "cancelled" ? (
                    <div className="mt-12">
                      <a className="button button-primary button-small" href={event.meeting_url} target="_blank" rel="noreferrer">
                        {isFamilyMeeting ? "Entrar na reunião ↗" : "Entrar na aula ↗"}
                      </a>
                    </div>
                  ) : null}
                  {canRespond ? (
                    <div className="family-agenda-response mt-12">
                      <p className="muted">Confirme para a professora saber se a família poderá participar.</p>
                      <div className="flex gap-8 wrap">
                        <form action={respondToAgendaEvent}>
                          <input type="hidden" name="eventId" value={event.id} />
                          <input type="hidden" name="studentId" value={selectedChild.student_id} />
                          <input type="hidden" name="response" value="confirmed" />
                          <button className="button button-secondary button-small" type="submit">Confirmar presença</button>
                        </form>
                        <details className="plan-editor">
                          <summary className="button button-ghost button-small">Não poderei comparecer</summary>
                          <form action={respondToAgendaEvent} className="form-stack compact-form mt-12">
                            <input type="hidden" name="eventId" value={event.id} />
                            <input type="hidden" name="studentId" value={selectedChild.student_id} />
                            <input type="hidden" name="response" value="unavailable" />
                            <div className="field">
                              <label>Observação <span className="field-optional">opcional</span></label>
                              <textarea className="textarea textarea-compact" name="note" maxLength={1000} placeholder="Ex.: nesse horário não conseguiremos participar." />
                            </div>
                            <button className="button button-danger button-small" type="submit">Registrar que não poderei comparecer</button>
                          </form>
                        </details>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : <EmptyState title="Nenhum compromisso agendado" description={`Quando o professor marcar uma aula ou reunião para ${selectedChild.student_name}, ela aparecerá aqui.`} />}
      </section>
    </>
  );
}
