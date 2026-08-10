import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { getFamilyPortal } from "@/lib/family";

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

export default async function FamilyAgendaPage({ searchParams }: { searchParams: Promise<{ aluno?: string }> }) {
  const query = await searchParams;
  const { selectedChild, supabase, viewer } = await getFamilyPortal(query.aluno || null);
  if (!selectedChild) return <EmptyState title="Nenhuma criança vinculada" description="A agenda aparecerá quando houver uma criança vinculada." />;

  const guardianName = viewer.profile?.preferred_name || viewer.profile?.full_name || "Responsável";
  const { data: eventLinks } = await supabase
    .from("agenda_event_students")
    .select("student_id,event_id,agenda_events(id,title,description,event_type,starts_at,ends_at,status,location,meeting_url,visible_to_guardian)")
    .eq("student_id", selectedChild.student_id)
    .limit(100);

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

      <section className="panel">
        {events.length ? (
          <div className="form-stack">
            {events.map((item: any) => {
              const event = item.agenda_events;
              const isFamilyMeeting = event.event_type === "meeting" || event.event_type === "family_meeting";
              return (
                <article className="family-upload-card" key={`${item.student_id}-${item.event_id}`}>
                  <div className="flex space-between gap-8 wrap">
                    <div>
                      <div className="flex gap-8 wrap"><Badge tone="blue">{eventLabel(event.event_type)}</Badge><Badge tone={tone(event.status)}>{statusLabel(event.status)}</Badge></div>
                      <h3>{event.title}</h3>
                      <p>{event.description || eventLabel(event.event_type)}</p>
                      {isFamilyMeeting ? <small className="muted">Responsável: {guardianName}</small> : null}
                    </div>
                  </div>
                  <div className="teacher-resource-meta"><span>{dt(event.starts_at)}{event.ends_at ? ` → ${dt(event.ends_at)}` : ""}</span>{event.location ? <span>• {event.location}</span> : null}</div>
                  {event.meeting_url && event.status !== "cancelled" ? (
                    <div className="mt-12">
                      <a className="button button-primary button-small" href={event.meeting_url} target="_blank" rel="noreferrer">
                        {isFamilyMeeting ? "Entrar na reunião ↗" : "Entrar na aula ↗"}
                      </a>
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
