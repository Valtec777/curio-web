-- CURIÓ · Agenda operacional
-- Reaproveita agenda_events/agenda_event_students e reforça idempotência + RLS.

alter table public.agenda_events
  add column if not exists idempotency_key text,
  add column if not exists request_day date not null default current_date;

create unique index if not exists agenda_events_teacher_idempotency_day_uidx
  on public.agenda_events(created_by_teacher_id, idempotency_key, request_day)
  where idempotency_key is not null;

-- Aluno e família só podem ler o evento quando a flag de visibilidade correspondente estiver ativa.
drop policy if exists agenda_select on public.agenda_events;
create policy agenda_select on public.agenda_events
for select to authenticated
using (
  private.has_role('admin'::app_role)
  or created_by_teacher_id = private.teacher_id_for_user()
  or ((class_id is not null) and private.teacher_has_class(class_id))
  or exists (
    select 1
    from public.agenda_event_students aes
    where aes.event_id = agenda_events.id
      and (
        (
          visible_to_student
          and aes.student_id in (
            select s.id from public.students s
            where s.auth_user_id = (select auth.uid())
              and s.deleted_at is null
          )
        )
        or (
          visible_to_guardian
          and private.guardian_has_student(aes.student_id)
        )
      )
  )
);

drop policy if exists agenda_students_select on public.agenda_event_students;
create policy agenda_students_select on public.agenda_event_students
for select to authenticated
using (
  private.has_role('admin'::app_role)
  or private.teacher_has_student(student_id)
  or exists (
    select 1
    from public.agenda_events e
    where e.id = event_id
      and (
        (
          e.visible_to_student
          and student_id in (
            select s.id from public.students s
            where s.auth_user_id = (select auth.uid())
              and s.deleted_at is null
          )
        )
        or (e.visible_to_guardian and private.guardian_has_student(student_id))
      )
  )
);

create or replace function public.create_teacher_agenda_event(
  p_idempotency_key text,
  p_student_id uuid,
  p_title text,
  p_description text,
  p_event_type text,
  p_starts_at timestamptz,
  p_ends_at timestamptz default null,
  p_meeting_url text default null,
  p_location text default null,
  p_visible_to_student boolean default true,
  p_visible_to_guardian boolean default true
)
returns uuid
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  v_teacher_id uuid;
  v_event_id uuid;
  v_request_day date := (p_starts_at at time zone 'America/Bahia')::date;
begin
  v_teacher_id := private.teacher_id_for_user();
  if v_teacher_id is null then
    raise exception 'teacher profile required';
  end if;
  if not private.teacher_has_student(p_student_id) then
    raise exception 'student is not linked to this teacher';
  end if;
  if nullif(trim(p_idempotency_key), '') is null then
    raise exception 'idempotency key required';
  end if;
  if nullif(trim(p_title), '') is null then
    raise exception 'title required';
  end if;
  if p_ends_at is not null and p_ends_at <= p_starts_at then
    raise exception 'end must be after start';
  end if;

  select e.id into v_event_id
  from public.agenda_events e
  where e.created_by_teacher_id = v_teacher_id
    and e.idempotency_key = p_idempotency_key
    and e.request_day = v_request_day
  limit 1;

  if v_event_id is not null then
    return v_event_id;
  end if;

  insert into public.agenda_events(
    created_by_teacher_id,title,description,event_type,starts_at,ends_at,status,
    meeting_url,location,visible_to_student,visible_to_guardian,idempotency_key,request_day
  ) values (
    v_teacher_id,trim(p_title),nullif(trim(p_description),''),p_event_type,p_starts_at,p_ends_at,'scheduled',
    nullif(trim(p_meeting_url),''),nullif(trim(p_location),''),p_visible_to_student,p_visible_to_guardian,p_idempotency_key,v_request_day
  ) returning id into v_event_id;

  insert into public.agenda_event_students(event_id,student_id)
  values (v_event_id,p_student_id)
  on conflict (event_id,student_id) do nothing;

  return v_event_id;
exception
  when unique_violation then
    select e.id into v_event_id
    from public.agenda_events e
    where e.created_by_teacher_id = v_teacher_id
      and e.idempotency_key = p_idempotency_key
      and e.request_day = v_request_day
    limit 1;
    if v_event_id is null then raise; end if;
    return v_event_id;
end;
$$;

revoke all on function public.create_teacher_agenda_event(text,uuid,text,text,text,timestamptz,timestamptz,text,text,boolean,boolean) from public;
grant execute on function public.create_teacher_agenda_event(text,uuid,text,text,text,timestamptz,timestamptz,text,text,boolean,boolean) to authenticated;
