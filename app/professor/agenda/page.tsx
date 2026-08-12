import { randomUUID } from "node:crypto";
import Link from "next/link";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { getCurrentTeacher } from "@/lib/teacher";
import { createAgendaEvent, setAgendaEventStatus } from "./actions";
import { AgendaSubmitButton } from "./submit-button";

const HISTORY_PAGE_SIZE = 30;

function dt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bahia" }).format(new Date(value));
}

function tone(status?: string | null): "green" | "yellow" | "pink" | "blue" | "neutral" {
  if (status === "completed") return "green";
  if (status === "confirmed") return "blue";
  if (status === "cancelled") return "pink";
  return "yellow";
}

function statusLabel(status?: string | null) {
  if (status === "scheduled") return "Agendado";
  if (status === "confirmed") return "Confirmado";
  if (status === "completed") return "Realizado";
  if (status === "cancelled") return "Cancelado";
  return status || "—";
}

function typeLabel(type?: string | null) {
  if (type === "class") return "Aula";
  if (type === "review") return "Revisão";
  if (type === "family_meeting" || type === "meeting") return "Reunião com a família";
  if (type === "assessment") return "Avaliação";
  if (type === "deadline") return "Prazo";
  if (type === "reminder") return "Lembrete";
  return "Outro";
}

function pageNumber(value?: string) {
  const parsed = Number(value || 1);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function ProfessorAgendaPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string; pagina?: string }> }) {
  const query = await searchParams;
  const page = pageNumber(query.pagina);
  const from = (page - 1) * HISTORY_PAGE_SIZE;
  const to = from + HISTORY_PAGE_SIZE - 1;
  const { teacher, supabase } = await getCurrentTeacher();
  if (!teacher) return <EmptyState title="Perfil de professor ainda não vinculado" description="A administração precisa concluir seu perfil antes de criar encontros." />;

  const nowIso = new Date().toISOString();
  const [{ data: links }, { data: events, count }, { data: upcoming }, { data: guardianRows }] = await Promise.all([
    supabase.from("teacher_students").select("student_id,students(id,preferred_name,full_name,deleted_at)").eq("teacher_id", teacher.id).eq("active", true),
    supabase
      .from("agenda_events")
      .select("id,title,description,event_type,starts_at,ends_at,status,meeting_url,location,visible_to_student,visible_to_guardian,agenda_event_students(student_id,students(preferred_name,full_name))", { count: "exact" })
      .eq("created_by_teacher_id", teacher.id)
      .order("starts_at", { ascending: false })
      .range(from, to),
    supabase
      .from("agenda_events")
      .select("id,title,description,event_type,starts_at,ends_at,status,meeting_url,location,visible_to_student,visible_to_guardian,agenda_event_students(student_id,students(preferred_name,full_name))")
      .eq("created_by_teacher_id", teacher.id)
      .gte("starts_at", nowIso)
      .neq("status", "cancelled")
      .order("starts_at")
      .limit(8),
    supabase.rpc("teacher_linked_guardian_names"),
  ]);

  const students = (links ?? []).filter((link: any) => link.students && !link.students.deleted_at);
  const guardiansByStudent = new Map<string, string[]>();
  const guardianNameById = new Map<string, string>();
  for (const row of guardianRows ?? []) {
    const current = guardiansByStudent.get(row.student_id) ?? [];
    current.push(`${row.guardian_name} (${row.relationship})`);
    guardiansByStudent.set(row.student_id, current);
    guardianNameById.set(row.guardian_id, row.guardian_name);
  }

  const eventIds = [...new Set([...(events ?? []).map((event: any) => event.id), ...(upcoming ?? []).map((event: any) => event.id)])];
  const { data: responseRows } = eventIds.length
    ? await supabase
        .from("agenda_event_guardian_responses")
        .select("event_id,student_id,guardian_id,response,note,responded_at")
        .in("event_id", eventIds)
        .order("responded_at", { ascending: false })
    : { data: [] as any[] };
  const responsesByEvent = new Map<string, any[]>();
  for (const row of responseRows ?? []) {
    const current = responsesByEvent.get(row.event_id) ?? [];
    current.push(row);
    responsesByEvent.set(row.event_id, current);
  }

  const total = count ?? events?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));

  return (
    <>
      <PageHeader
        eyebrow="Professor • Visão geral"
        title="Agenda"
        description="Aulas, revisões, reuniões com a família e outros compromissos, com link e situação no mesmo lugar."
      />
      {query.erro && <div className="form-message form-error">{query.erro}</div>}
      {query.sucesso && <div className="form-message form-success">{query.sucesso}</div>}

      <div className="teacher-library-filter">
        <span>{upcoming?.length ?? 0} próximos</span><span>Aulas</span><span>Revisões</span><span>Reuniões com família</span><span>Outros</span>
      </div>

      <div className="grid-2">
        <section className="panel" id="novo">
          <div className="panel-head"><div><h2>Novo compromisso</h2><p>Escolha o aluno, o tipo, a situação e o horário. O link já fica pronto no cartão do encontro.</p></div></div>
          <form action={createAgendaEvent} className="form-stack">
            <input type="hidden" name="idempotencyKey" value={randomUUID()} />
            <div className="field"><label>Aluno *</label><select className="select" name="studentId" required defaultValue=""><option value="" disabled>Selecione</option>{students.map((link: any) => <option key={link.student_id} value={link.student_id}>{link.students?.preferred_name || link.students?.full_name || "Aluno"}</option>)}</select></div>
            <div className="field"><label>Título *</label><input className="input" name="title" placeholder="Ex.: Aula de revisão de frações" required /></div>
            <div className="form-row">
              <div className="field"><label>Tipo *</label><select className="select" name="eventType" defaultValue="class"><option value="class">Aula</option><option value="review">Revisão</option><option value="family_meeting">Reunião com a família</option><option value="assessment">Avaliação</option><option value="other">Outro</option></select></div>
              <div className="field"><label>Status *</label><select className="select" name="status" defaultValue="scheduled"><option value="scheduled">Agendado</option><option value="confirmed">Confirmado</option><option value="completed">Realizado</option><option value="cancelled">Cancelado</option></select></div>
            </div>
            <div className="form-row"><div className="field"><label>Data e início *</label><input className="input" type="datetime-local" name="startsAt" required /></div><div className="field"><label>Fim</label><input className="input" type="datetime-local" name="endsAt" /></div></div>
            <div className="field"><label>Link da reunião / aula</label><input className="input" type="url" name="meetingUrl" placeholder="https://meet.google.com/..." /></div>
            <div className="field"><label>Observações</label><textarea className="textarea textarea-compact" name="description" placeholder="Ex.: revisar páginas 18 a 22 antes do encontro" /></div>
            <div className="field"><label>Local <span className="field-optional">opcional</span></label><input className="input" name="location" placeholder="Online, Sala 2..." /></div>
            <div className="plan-check-row meeting-audience-row"><label><input type="checkbox" name="visibleToStudent" defaultChecked /> Mostrar ao aluno</label><label><input type="checkbox" name="visibleToGuardian" defaultChecked /> Mostrar à família</label></div>
            <AgendaSubmitButton />
          </form>
        </section>

        <section className="panel">
          <div className="panel-head"><div><h2>Próximos encontros</h2><p>O link aparece aqui e também no painel Hoje.</p></div></div>
          {upcoming?.length ? <div className="teacher-agenda-list">{upcoming.map((event: any) => {
            const student = event.agenda_event_students?.[0]?.students;
            const attendance = responsesByEvent.get(event.id) ?? [];
            const hasUnavailable = attendance.some((row: any) => row.response === "unavailable");
            const hasConfirmed = attendance.some((row: any) => row.response === "confirmed");
            return <article className="teacher-agenda-item" key={event.id}><div><strong>{event.title}</strong><small>{typeLabel(event.event_type)} · {student?.preferred_name || student?.full_name || "Aluno"} · {dt(event.starts_at)}</small>{hasUnavailable ? <small className="muted">Família avisou que não poderá comparecer.</small> : hasConfirmed ? <small className="muted">Presença da família confirmada.</small> : null}</div>{event.meeting_url ? <a className="button button-primary button-small" href={event.meeting_url} target="_blank" rel="noreferrer">Entrar ↗</a> : <Badge tone={tone(event.status)}>{statusLabel(event.status)}</Badge>}</article>;
          })}</div> : <EmptyState title="Agenda livre" description="Nenhum encontro futuro cadastrado." />}
        </section>
      </div>

      <section className="panel">
        <div className="panel-head"><div><h2>Compromissos cadastrados</h2><p>{total} compromisso(s) no histórico. A página carrega no máximo {HISTORY_PAGE_SIZE} por vez.</p></div></div>
        {events?.length ? <div className="teacher-resource-list">{events.map((event: any) => {
          const participantLink = event.agenda_event_students?.[0];
          const participant = participantLink?.students;
          const guardianNames = participantLink?.student_id ? guardiansByStudent.get(participantLink.student_id) ?? [] : [];
          const attendanceResponses = responsesByEvent.get(event.id) ?? [];
          return <article className="teacher-resource-card" key={event.id}>
            <div className="teacher-resource-top"><div><div className="flex gap-8 wrap"><Badge tone={tone(event.status)}>{statusLabel(event.status)}</Badge><Badge tone="purple">{typeLabel(event.event_type)}</Badge></div><h3>{event.title}</h3><p>{participant?.preferred_name || participant?.full_name || "Aluno"}{event.description ? ` · ${event.description}` : ""}</p></div>{event.meeting_url && <a className="button button-secondary button-small" href={event.meeting_url} target="_blank" rel="noreferrer">Abrir link ↗</a>}</div>
            <div className="teacher-resource-meta"><span>{dt(event.starts_at)}{event.ends_at ? ` → ${dt(event.ends_at)}` : ""}</span>{event.location && <span>• {event.location}</span>}</div>
            {(event.event_type === "family_meeting" || event.event_type === "meeting") && guardianNames.length > 0 && <small className="muted">Responsável(is): {guardianNames.join(", ")}</small>}
            {attendanceResponses.length > 0 ? <div className="family-highlight mt-12"><strong>Resposta da família</strong>{attendanceResponses.map((response: any) => <p key={`${response.guardian_id}-${response.responded_at}`}><Badge tone={response.response === "confirmed" ? "green" : "pink"}>{response.response === "confirmed" ? "Presença confirmada" : "Não poderá comparecer"}</Badge> <span>{guardianNameById.get(response.guardian_id) || "Responsável"}</span>{response.note ? <span> · {response.note}</span> : null}</p>)}</div> : null}
            <div className="teacher-resource-actions">
              {event.status === "scheduled" && <form action={setAgendaEventStatus}><input type="hidden" name="eventId" value={event.id}/><input type="hidden" name="status" value="confirmed"/><button className="button button-secondary button-small" type="submit">Confirmar</button></form>}
              {event.status !== "completed" && event.status !== "cancelled" && <form action={setAgendaEventStatus}><input type="hidden" name="eventId" value={event.id}/><input type="hidden" name="status" value="completed"/><button className="button button-secondary button-small" type="submit">Marcar realizado</button></form>}
              {event.status !== "cancelled" && event.status !== "completed" && <form action={setAgendaEventStatus}><input type="hidden" name="eventId" value={event.id}/><input type="hidden" name="status" value="cancelled"/><button className="button button-ghost button-small" type="submit">Cancelar</button></form>}
            </div>
          </article>;
        })}</div> : <EmptyState title="Nenhum compromisso" description="Crie o primeiro usando o formulário acima." />}

        {totalPages > 1 && (
          <nav className="flex gap-8 wrap align-center space-between mt-16" aria-label="Paginação da agenda">
            <small className="muted">Página {page} de {totalPages}</small>
            <div className="flex gap-8 wrap">
              {page > 1 && <Link className="button button-secondary button-small" href={`/professor/agenda?pagina=${page - 1}`}>← Anterior</Link>}
              {page < totalPages && <Link className="button button-secondary button-small" href={`/professor/agenda?pagina=${page + 1}`}>Próxima →</Link>}
            </div>
          </nav>
        )}
      </section>
    </>
  );
}
