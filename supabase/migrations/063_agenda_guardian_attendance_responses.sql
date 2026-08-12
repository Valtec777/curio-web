-- CURIÓ · confirmação de presença da Família em compromissos da Agenda.
-- Registra a resposta por responsável/aluno/evento e permite leitura pelo Professor dono do evento.

create table if not exists public.agenda_event_guardian_responses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.agenda_events(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  guardian_id uuid not null references public.guardians(id) on delete restrict,
  response text not null check (response in ('confirmed','unavailable')),
  note text,
  responded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, student_id, guardian_id)
);

create index if not exists agenda_guardian_responses_event_idx
  on public.agenda_event_guardian_responses(event_id, responded_at desc);
create index if not exists agenda_guardian_responses_guardian_idx
  on public.agenda_event_guardian_responses(guardian_id, responded_at desc);

alter table public.agenda_event_guardian_responses enable row level security;
revoke all on table public.agenda_event_guardian_responses from anon;
revoke insert, update, delete on table public.agenda_event_guardian_responses from authenticated;
grant select on table public.agenda_event_guardian_responses to authenticated;

drop policy if exists agenda_guardian_responses_select on public.agenda_event_guardian_responses;
create policy agenda_guardian_responses_select
on public.agenda_event_guardian_responses
for select
to authenticated
using (
  (select private.has_role('admin'::public.app_role))
  or guardian_id = (select private.guardian_id_for_user())
  or exists (
    select 1
    from public.agenda_events ae
    join public.teachers t on t.id = ae.created_by_teacher_id
    where ae.id = event_id
      and t.profile_id = (select auth.uid())
      and t.active = true
      and (select private.has_role('teacher'::public.app_role))
  )
);

create or replace function public.respond_to_agenda_event(
  p_event_id uuid,
  p_student_id uuid,
  p_response text,
  p_note text default null
)
returns public.agenda_event_guardian_responses
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_guardian_id uuid;
  v_row public.agenda_event_guardian_responses%rowtype;
begin
  if auth.uid() is null or not private.has_role('guardian'::public.app_role) then
    raise exception 'guardian role required';
  end if;

  if p_response not in ('confirmed','unavailable') then
    raise exception 'invalid response';
  end if;

  v_guardian_id := private.guardian_id_for_user();
  if v_guardian_id is null then
    raise exception 'active guardian profile required';
  end if;

  if not private.guardian_has_student(p_student_id) then
    raise exception 'student is not linked to guardian';
  end if;

  if not exists (
    select 1
    from public.agenda_events ae
    join public.agenda_event_students aes on aes.event_id = ae.id
    where ae.id = p_event_id
      and aes.student_id = p_student_id
      and ae.visible_to_guardian = true
      and ae.status in ('scheduled','confirmed')
  ) then
    raise exception 'agenda event is not available for response';
  end if;

  insert into public.agenda_event_guardian_responses(
    event_id, student_id, guardian_id, response, note, responded_at, updated_at
  ) values (
    p_event_id,
    p_student_id,
    v_guardian_id,
    p_response,
    nullif(left(trim(coalesce(p_note,'')), 1000), ''),
    now(),
    now()
  )
  on conflict (event_id, student_id, guardian_id)
  do update set
    response = excluded.response,
    note = excluded.note,
    responded_at = now(),
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.respond_to_agenda_event(uuid,uuid,text,text) from public, anon;
grant execute on function public.respond_to_agenda_event(uuid,uuid,text,text) to authenticated;

comment on table public.agenda_event_guardian_responses is
'Guardian attendance responses for agenda events visible to the family. One current response per guardian/student/event is retained with response timestamp.';
