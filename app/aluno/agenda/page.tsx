import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { getCurrentStudent } from "@/lib/student";

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bahia" }).format(new Date(value));
}

function typeLabel(type: string) {
  if (type === "class") return "Aula";
  if (type === "review") return "Revisão";
  if (type === "family_meeting" || type === "meeting") return "Encontro";
  if (type === "assessment") return "Avaliação";
  return "Agenda";
}

function statusLabel(status: string) {
  if (status === "scheduled") return "Agendado";
  if (status === "confirmed") return "Confirmado";
  if (status === "completed") return "Realizado";
  if (status === "cancelled") return "Cancelado";
  return status;
}

export default async function StudentAgendaPage() {
  const { student, supabase } = await getCurrentStudent();
  const { data: links } = await supabase
    .from("agenda_event_students")
    .select("event_id,agenda_events(id,title,description,event_type,starts_at,ends_at,status,meeting_url,location,visible_to_student)")
    .eq("student_id", student.id)
    .limit(160);

  const events = (links ?? []).map((row:any)=>Array.isArray(row.agenda_events) ? row.agenda_events[0] : row.agenda_events).filter((event:any)=>event?.visible_to_student).sort((a:any,b:any)=>+new Date(a.starts_at)-+new Date(b.starts_at));
  const now = Date.now();
  const upcoming = events.filter((event:any)=>event.status !== "cancelled" && +new Date(event.starts_at) >= now);
  const previous = events.filter((event:any)=>event.status === "cancelled" || +new Date(event.starts_at) < now).reverse();

  const card = (event:any, past=false) => <article className="student-agenda-card" key={event.id}>
    <div className="flex space-between gap-8 wrap">
      <div className="flex gap-8 wrap"><Badge tone={event.status === "cancelled" ? "neutral" : past ? "green" : "blue"}>{typeLabel(event.event_type)}</Badge><Badge tone={event.status === "cancelled" ? "pink" : event.status === "confirmed" ? "green" : "yellow"}>{statusLabel(event.status)}</Badge></div>
      <strong>{dt(event.starts_at)}</strong>
    </div>
    <h3>{event.title}</h3>
    <p>{event.description || event.location || "Compromisso do PLUMARELI"}</p>
    {event.ends_at ? <small className="muted">Termina: {dt(event.ends_at)}</small> : null}
    {!past && event.status !== "cancelled" && event.meeting_url ? <div className="mt-12"><a className="button button-primary" href={event.meeting_url} target="_blank" rel="noreferrer">Entrar na aula ↗</a></div> : null}
  </article>;

  return <>
    <PageHeader eyebrow="Explorador Plumareli" title="Minha agenda" description="Aulas, revisões, avaliações e encontros com sua professora em um só lugar." />
    <section className="panel"><div className="panel-head"><div><h2>O que vem por aí</h2><p>Quando houver link de aula, o botão para entrar aparece aqui.</p></div></div>{upcoming.length ? <div className="student-agenda-list">{upcoming.map((e:any)=>card(e))}</div> : <EmptyState title="Nenhum encontro próximo" description="Quando a professora marcar uma aula ou revisão, ela aparecerá aqui." />}</section>
    <section className="panel"><div className="panel-head"><div><h2>Anteriores</h2><p>Seu histórico recente de agenda.</p></div></div>{previous.length ? <div className="student-agenda-list">{previous.slice(0,40).map((e:any)=>card(e,true))}</div> : <EmptyState title="Sem eventos anteriores" description="Seu histórico começa a aparecer depois dos primeiros encontros." />}</section>
  </>;
}
