-- CURIÓ — performance e escalabilidade em caminhos quentes.
-- Mantém regras de negócio/RLS; apenas reduz trabalho repetido e adiciona índices
-- alinhados às consultas reais auditadas no Portal do Professor e suporte.

-- Diretório paginado do professor: filtra por professor/ativo e ordena pelo vínculo.
create index if not exists teacher_students_active_teacher_created_idx
  on public.teacher_students (teacher_id, created_at desc, student_id)
  where active = true;

-- Pendências do professor.
create index if not exists notebook_assignments_teacher_status_student_idx
  on public.notebook_assignments (assigned_by_teacher_id, status, student_id)
  where assigned_by_teacher_id is not null;

create index if not exists submissions_pending_review_student_idx
  on public.submissions (student_id)
  where review_status = 'pending';

create index if not exists assessments_teacher_upcoming_idx
  on public.assessments (created_by_teacher_id, scheduled_for)
  where status <> 'archived';

-- Policies de suporte consultam o responsável atribuído; o linter apontou ausência.
create index if not exists support_tickets_assigned_to_user_idx
  on public.support_tickets (assigned_to_user_id, created_at desc)
  where assigned_to_user_id is not null;

create index if not exists support_ticket_messages_sender_user_idx
  on public.support_ticket_messages (sender_user_id, created_at desc);

create index if not exists student_occurrences_teacher_idx
  on public.student_occurrences (teacher_id, occurred_at desc)
  where teacher_id is not null;

-- Agrega somente números do dashboard. SECURITY INVOKER mantém o RLS normal do
-- usuário autenticado; não cria uma via privilegiada paralela.
create or replace function public.teacher_dashboard_counts()
returns table (
  active_students integer,
  mission_pending integer,
  notebook_pending integer,
  waiting_missions integer,
  upcoming_assessments integer,
  unread_messages integer
)
language plpgsql
stable
security invoker
set search_path = public, private, pg_temp
as $$
declare
  v_teacher uuid;
  v_user uuid := (select auth.uid());
  v_active_students integer := 0;
  v_mission_pending integer := 0;
  v_notebook_pending integer := 0;
  v_waiting_missions integer := 0;
  v_upcoming_assessments integer := 0;
  v_unread_messages integer := 0;
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  v_teacher := private.teacher_id_for_user();
  if v_teacher is null then
    raise exception 'teacher profile required';
  end if;

  select count(*)::int
    into v_active_students
  from public.teacher_students ts
  join public.students s on s.id = ts.student_id
  where ts.teacher_id = v_teacher
    and ts.active = true
    and s.deleted_at is null
    and s.status = 'active';

  select count(*)::int
    into v_mission_pending
  from public.submissions sub
  join public.teacher_students ts
    on ts.student_id = sub.student_id
   and ts.teacher_id = v_teacher
   and ts.active = true
  join public.students s on s.id = sub.student_id
  where sub.review_status = 'pending'
    and s.deleted_at is null
    and s.status = 'active';

  select count(*)::int
    into v_notebook_pending
  from public.notebook_assignments na
  join public.teacher_students ts
    on ts.student_id = na.student_id
   and ts.teacher_id = v_teacher
   and ts.active = true
  join public.students s on s.id = na.student_id
  where na.status = 'submitted'
    and s.deleted_at is null
    and s.status = 'active';

  select count(*)::int
    into v_waiting_missions
  from public.mission_students ms
  join public.teacher_students ts
    on ts.student_id = ms.student_id
   and ts.teacher_id = v_teacher
   and ts.active = true
  join public.students s on s.id = ms.student_id
  where ms.assigned_by_teacher_id = v_teacher
    and ms.status in ('assigned', 'in_progress')
    and s.deleted_at is null
    and s.status = 'active';

  select count(*)::int
    into v_upcoming_assessments
  from public.assessments a
  where a.created_by_teacher_id = v_teacher
    and a.scheduled_for >= now()
    and a.scheduled_for <= now() + interval '7 days'
    and a.status <> 'archived';

  select count(*)::int
    into v_unread_messages
  from public.message_thread_participants p
  join public.messages m
    on m.thread_id = p.thread_id
   and m.deleted_at is null
   and m.sender_user_id <> v_user
   and m.created_at > coalesce(p.last_read_at, '-infinity'::timestamptz)
  where p.user_id = v_user;

  return query
  select
    v_active_students,
    v_mission_pending,
    v_notebook_pending,
    v_waiting_missions,
    v_upcoming_assessments,
    v_unread_messages;
end
$$;

revoke all on function public.teacher_dashboard_counts() from public, anon;
grant execute on function public.teacher_dashboard_counts() to authenticated;

-- Otimiza as seis policies apontadas pelo Supabase auth_rls_initplan. A autorização
-- permanece semanticamente igual; auth.uid() só deixa de ser recalculado por linha.
drop policy if exists access_self_insert on public.access_events;
create policy access_self_insert
on public.access_events for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists occurrences_teacher_insert on public.student_occurrences;
create policy occurrences_teacher_insert
on public.student_occurrences for insert to authenticated
with check (
  private.has_role('teacher'::public.app_role)
  and private.teacher_has_student(student_id)
  and teacher_id = private.teacher_id_for_user()
  and created_by_user_id = (select auth.uid())
);

drop policy if exists support_tickets_self_insert on public.support_tickets;
create policy support_tickets_self_insert
on public.support_tickets for insert to authenticated
with check (opened_by_user_id = (select auth.uid()));

drop policy if exists support_tickets_self_select on public.support_tickets;
create policy support_tickets_self_select
on public.support_tickets for select to authenticated
using (
  opened_by_user_id = (select auth.uid())
  or assigned_to_user_id = (select auth.uid())
);

drop policy if exists support_messages_participant_insert on public.support_ticket_messages;
create policy support_messages_participant_insert
on public.support_ticket_messages for insert to authenticated
with check (
  sender_user_id = (select auth.uid())
  and exists (
    select 1
    from public.support_tickets t
    where t.id = support_ticket_messages.ticket_id
      and (
        t.opened_by_user_id = (select auth.uid())
        or t.assigned_to_user_id = (select auth.uid())
      )
  )
);

drop policy if exists support_messages_participant_select on public.support_ticket_messages;
create policy support_messages_participant_select
on public.support_ticket_messages for select to authenticated
using (
  exists (
    select 1
    from public.support_tickets t
    where t.id = support_ticket_messages.ticket_id
      and (
        t.opened_by_user_id = (select auth.uid())
        or t.assigned_to_user_id = (select auth.uid())
      )
  )
);
