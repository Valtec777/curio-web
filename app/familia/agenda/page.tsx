import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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

export default async function FamilyAgendaPage() {
  const viewer = await requireRole("guardian");
  const supabase = await createClient();
  const { data: guardian } = await supabase
    .from("guardians")
    .select("id")
    .eq("profile_id", viewer.user.id)
    .maybeSingle();

  if (!guardian) {
    return <EmptyState title="Perfil da família incompleto" description="A administração precisa concluir o vínculo do responsável." />;
  }

  const { data: links } = await supabase
    .from("guardian_students")
    .select("student_id,students(preferred_name,full_name,deleted_at)")
    .eq("guardian_id", guardian.id);

  const activeLinks = (links ?? []).filter((link: any) => link.students && !link.students.deleted_at);
  const studentIds = activeLinks.map((link: any) => link.student_id);
  const studentName = new Map(activeLinks.map((link: any) => [link.student_id, link.students?.preferred_name || link.students?.full_name || "Criança"]));
  const guardianName = viewer.profile?.preferred_name || viewer.profile?.full_name || "Responsável";

  const { data: eventLinks } = studentIds.length
    ? await supabase
        .from("agenda_event_students")
        .select("student_id,event_id,agenda_events(id,title,description,event_type,starts_at,ends_at,status,location,meeting_url,visible_to_guardian)")
        .in("student_id", studentIds)
        .limit(100)
    : { data: [] as any[] };

  const events = (eventLinks ?? [])
    .filter((item: any) => item.agenda_events?.visible_to_guardian)
    .filter((item: any) => new Date(item.agenda_events.starts_at).getTime() >= Date.now() - 6 * 60 * 60 * 1000)
    .sort((a: any, b: any) => +new Date(a.agenda_events.starts_at) - +new Date(b.agenda_events.starts_at));

  return (
    <>
      <PageHeader
        eyebrow="Ninho da Família"
        title="Agenda"
        description="Aulas, reuniões e compromissos dos alunos vinculados à sua família."
      />

      <section className="panel">
        {events.length ? (
          <div className="form-stack">
            {events.map((item: any) => {
              const event = item.agenda_events;
              const isMeeting = event.event_type === "meeting";
              return (
                <article className="mission-card" key={`${item.student_id}-${item.event_id}`}>
                  <div className="flex space-between gap-8 wrap">
                    <div>
                      <strong>{event.title}</strong>
                      <p>{studentName.get(item.student_id)} • {event.description || (isMeeting ? "Reunião com a família" : event.event_type)}</p>
                      {isMeeting && <small className="muted">Responsável: {guardianName}</small>}
                    </div>
                    <Badge tone={tone(event.status)}>{event.status}</Badge>
                  </div>
                  <small className="muted">{dt(event.starts_at)}{event.ends_at ? ` → ${dt(event.ends_at)}` : ""}{event.location ? ` • ${event.location}` : ""}</small>
                  {event.meeting_url && event.status !== "cancelled" && (
                    <div className="mt-12">
                      <a className="button button-primary button-small" href={event.meeting_url} target="_blank" rel="noreferrer">
                        {isMeeting ? "Entrar na reunião ↗" : "Entrar na aula ↗"}
                      </a>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title="Nenhum compromisso visível" description="Quando o professor marcar uma aula ou reunião para sua família, ela aparecerá aqui." />
        )}
      </section>
    </>
  );
}
