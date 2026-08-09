-- CURIÓ: acesso da criança a partir da conta da família + PIN de 4 dígitos

create table if not exists public.guardian_portal_pins (
  guardian_id uuid primary key references public.guardians(id) on delete cascade,
  pin_hash text not null,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.guardian_portal_pins enable row level security;
revoke all on public.guardian_portal_pins from anon, authenticated;

create or replace function public.guardian_pin_status()
returns table(has_pin boolean, locked_until timestamptz)
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_guardian_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select g.id into v_guardian_id
  from public.guardians g
  where g.profile_id = auth.uid()
  limit 1;

  if v_guardian_id is null then
    return query select false, null::timestamptz;
    return;
  end if;

  return query
  select true, p.locked_until
  from public.guardian_portal_pins p
  where p.guardian_id = v_guardian_id;

  if not found then
    return query select false, null::timestamptz;
  end if;
end;
$$;

create or replace function public.set_guardian_portal_pin(p_pin text)
returns void
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_guardian_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN must contain exactly 4 digits';
  end if;

  select g.id into v_guardian_id
  from public.guardians g
  where g.profile_id = auth.uid()
  limit 1;

  if v_guardian_id is null then
    raise exception 'guardian profile not found';
  end if;

  insert into public.guardian_portal_pins (
    guardian_id,
    pin_hash,
    failed_attempts,
    locked_until,
    updated_at
  ) values (
    v_guardian_id,
    extensions.crypt(p_pin, extensions.gen_salt('bf', 8)),
    0,
    null,
    now()
  )
  on conflict (guardian_id) do update set
    pin_hash = excluded.pin_hash,
    failed_attempts = 0,
    locked_until = null,
    updated_at = now();
end;
$$;

create or replace function public.verify_guardian_portal_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_guardian_id uuid;
  v_row public.guardian_portal_pins%rowtype;
  v_next_attempts integer;
begin
  if auth.uid() is null then
    return false;
  end if;

  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    return false;
  end if;

  select g.id into v_guardian_id
  from public.guardians g
  where g.profile_id = auth.uid()
  limit 1;

  if v_guardian_id is null then
    return false;
  end if;

  select * into v_row
  from public.guardian_portal_pins p
  where p.guardian_id = v_guardian_id;

  if not found then
    return false;
  end if;

  if v_row.locked_until is not null and v_row.locked_until > now() then
    return false;
  end if;

  if v_row.pin_hash = extensions.crypt(p_pin, v_row.pin_hash) then
    update public.guardian_portal_pins
    set failed_attempts = 0,
        locked_until = null,
        updated_at = now()
    where guardian_id = v_guardian_id;
    return true;
  end if;

  v_next_attempts := coalesce(v_row.failed_attempts, 0) + 1;

  update public.guardian_portal_pins
  set failed_attempts = case when v_next_attempts >= 5 then 0 else v_next_attempts end,
      locked_until = case when v_next_attempts >= 5 then now() + interval '5 minutes' else null end,
      updated_at = now()
  where guardian_id = v_guardian_id;

  return false;
end;
$$;

revoke all on function public.guardian_pin_status() from public, anon;
revoke all on function public.set_guardian_portal_pin(text) from public, anon;
revoke all on function public.verify_guardian_portal_pin(text) from public, anon;
grant execute on function public.guardian_pin_status() to authenticated;
grant execute on function public.set_guardian_portal_pin(text) to authenticated;
grant execute on function public.verify_guardian_portal_pin(text) to authenticated;

-- A área da criança usa a sessão autenticada do responsável. As políticas abaixo
-- permitem que um responsável vinculado aja em nome da criança apenas nas ações
-- pedagógicas que o portal do aluno já oferece.
drop policy if exists submissions_student_insert on public.submissions;
create policy submissions_student_insert
on public.submissions
for insert
to authenticated
with check (
  (
    student_id in (
      select s.id from public.students s where s.auth_user_id = (select auth.uid())
    )
    or private.guardian_has_student(student_id)
  )
  and exists (
    select 1 from public.mission_students ms
    where ms.id = mission_student_id
      and ms.student_id = submissions.student_id
      and ms.status in ('assigned'::assignment_status, 'in_progress'::assignment_status)
  )
);

drop policy if exists submissions_student_delete_pending on public.submissions;
create policy submissions_student_delete_pending
on public.submissions
for delete
to authenticated
using (
  (
    student_id in (
      select s.id from public.students s where s.auth_user_id = (select auth.uid())
    )
    or private.guardian_has_student(student_id)
  )
  and review_status = 'pending'
);

drop policy if exists answers_select on public.answers;
create policy answers_select
on public.answers
for select
to authenticated
using (
  exists (
    select 1 from public.submissions sub
    where sub.id = answers.submission_id
      and (
        private.has_role('admin'::app_role)
        or private.teacher_has_student(sub.student_id)
        or private.guardian_has_student(sub.student_id)
        or sub.student_id in (
          select s.id from public.students s where s.auth_user_id = (select auth.uid())
        )
      )
  )
);

drop policy if exists answers_student_insert on public.answers;
create policy answers_student_insert
on public.answers
for insert
to authenticated
with check (
  exists (
    select 1 from public.submissions sub
    where sub.id = answers.submission_id
      and (
        private.guardian_has_student(sub.student_id)
        or sub.student_id in (
          select s.id from public.students s where s.auth_user_id = (select auth.uid())
        )
      )
  )
);

-- Corrige a relação missão ↔ atribuição na política de leitura.
drop policy if exists missions_select on public.missions;
create policy missions_select
on public.missions
for select
to authenticated
using (
  private.has_role('admin'::app_role)
  or created_by_teacher_id = private.teacher_id_for_user()
  or exists (
    select 1 from public.mission_students ms
    where ms.mission_id = missions.id
      and (
        ms.student_id in (
          select s.id from public.students s where s.auth_user_id = (select auth.uid())
        )
        or private.guardian_has_student(ms.student_id)
      )
  )
);
