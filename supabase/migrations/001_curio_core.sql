-- CURIÓ v1 — Schema central
-- Execute em um projeto Supabase novo.

create extension if not exists pgcrypto;
create extension if not exists citext;

do $$ begin
  create type public.app_role as enum ('admin', 'teacher', 'student', 'guardian');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.student_status as enum ('pilot', 'active', 'paused', 'inactive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.mission_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.assignment_status as enum ('assigned', 'in_progress', 'submitted', 'reviewed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.confidence_level as enum ('low', 'medium', 'high');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.skill_trend as enum ('improving', 'stable', 'attention');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  preferred_name text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.guardians (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.grades (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  active boolean not null default true
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null,
  preferred_name text not null,
  grade_id uuid references public.grades(id) on delete set null,
  school_name text,
  status public.student_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teacher_students (
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (teacher_id, student_id)
);

create table if not exists public.guardian_students (
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  relationship text,
  can_view_progress boolean not null default true,
  can_manage_access boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (guardian_id, student_id)
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true
);

create table if not exists public.contents (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  name text not null,
  parent_id uuid references public.contents(id) on delete set null,
  active boolean not null default true
);

create unique index if not exists contents_unique_root
on public.contents(subject_id, name)
where parent_id is null;

create unique index if not exists contents_unique_child
on public.contents(subject_id, name, parent_id)
where parent_id is not null;

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  created_by_teacher_id uuid not null references public.teachers(id) on delete restrict,
  title text not null,
  objective text not null,
  subject_id uuid references public.subjects(id) on delete set null,
  content_id uuid references public.contents(id) on delete set null,
  estimated_minutes integer not null default 20 check (estimated_minutes between 5 and 180),
  status public.mission_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mission_questions (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  position integer not null,
  prompt text not null,
  hint text,
  question_type text not null default 'open_text',
  primary_skill_id uuid not null references public.skills(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(mission_id, position)
);

create table if not exists public.mission_students (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  assigned_by_teacher_id uuid not null references public.teachers(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  due_at timestamptz,
  completed_at timestamptz,
  status public.assignment_status not null default 'assigned',
  unique(mission_id, student_id)
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  mission_student_id uuid not null unique references public.mission_students(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status text not null default 'submitted',
  review_status text not null default 'pending' check (review_status in ('pending', 'reviewed')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  question_id uuid not null references public.mission_questions(id) on delete cascade,
  answer_text text,
  score numeric(4,3) check (score is null or (score >= 0 and score <= 1)),
  reviewed_at timestamptz,
  reviewed_by_teacher_id uuid references public.teachers(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(submission_id, question_id)
);

create table if not exists public.pedagogical_evidence (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid references public.answers(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  question_id uuid references public.mission_questions(id) on delete set null,
  skill_id uuid not null references public.skills(id) on delete restrict,
  source_type text not null default 'mission',
  domain_level smallint not null check (domain_level between 0 and 4),
  autonomy_level smallint not null check (autonomy_level between 0 and 4),
  score numeric(4,3) check (score is null or (score >= 0 and score <= 1)),
  teacher_note text,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(answer_id, skill_id)
);

create table if not exists public.student_skill_states (
  student_id uuid not null references public.students(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  domain_level smallint not null default 0 check (domain_level between 0 and 4),
  autonomy_level smallint not null default 0 check (autonomy_level between 0 and 4),
  confidence public.confidence_level not null default 'low',
  trend public.skill_trend not null default 'stable',
  evidence_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (student_id, skill_id)
);

create table if not exists public.student_skill_state_history (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  domain_level smallint not null check (domain_level between 0 and 4),
  autonomy_level smallint not null check (autonomy_level between 0 and 4),
  confidence public.confidence_level not null,
  trend public.skill_trend not null,
  evidence_count integer not null,
  recorded_at timestamptz not null default now()
);

create table if not exists public.interventions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  skill_id uuid references public.skills(id) on delete set null,
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  kind text not null,
  description text not null,
  status text not null default 'planned',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Índices de acesso e RLS
create index if not exists idx_user_roles_user on public.user_roles(user_id);
create index if not exists idx_teachers_profile on public.teachers(profile_id);
create index if not exists idx_guardians_profile on public.guardians(profile_id);
create index if not exists idx_students_auth on public.students(auth_user_id);
create index if not exists idx_teacher_students_student on public.teacher_students(student_id);
create index if not exists idx_guardian_students_student on public.guardian_students(student_id);
create index if not exists idx_missions_teacher on public.missions(created_by_teacher_id);
create index if not exists idx_mission_questions_mission on public.mission_questions(mission_id);
create index if not exists idx_mission_students_student on public.mission_students(student_id);
create index if not exists idx_submissions_student on public.submissions(student_id);
create index if not exists idx_answers_submission on public.answers(submission_id);
create index if not exists idx_evidence_student_skill on public.pedagogical_evidence(student_id, skill_id, observed_at desc);
create index if not exists idx_skill_states_student on public.student_skill_states(student_id);
create index if not exists idx_history_student_skill on public.student_skill_state_history(student_id, skill_id, recorded_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists trg_students_touch on public.students;
create trigger trg_students_touch before update on public.students
for each row execute function public.touch_updated_at();

drop trigger if exists trg_missions_touch on public.missions;
create trigger trg_missions_touch before update on public.missions
for each row execute function public.touch_updated_at();

-- Cadastro público cria perfil de responsável.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, full_name, preferred_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email,''), '@', 1)),
    coalesce(new.raw_user_meta_data->>'preferred_name', new.raw_user_meta_data->>'full_name')
  )
  on conflict (id) do nothing;

  insert into public.user_roles(user_id, role)
  values (new.id, 'guardian')
  on conflict do nothing;

  insert into public.guardians(profile_id)
  values (new.id)
  on conflict (profile_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.has_role(target_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid())
      and role = target_role
  );
$$;

create or replace function private.teacher_id_for_user()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.teachers
  where profile_id = (select auth.uid())
    and active = true
  limit 1;
$$;

create or replace function private.guardian_id_for_user()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.guardians
  where profile_id = (select auth.uid())
  limit 1;
$$;

create or replace function private.teacher_has_student(target_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.teacher_students ts
    join public.teachers t on t.id = ts.teacher_id
    where t.profile_id = (select auth.uid())
      and ts.student_id = target_student
      and ts.active = true
      and t.active = true
  );
$$;

create or replace function private.guardian_has_student(target_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.guardian_students gs
    join public.guardians g on g.id = gs.guardian_id
    where g.profile_id = (select auth.uid())
      and gs.student_id = target_student
  );
$$;

create or replace function private.guardian_can_view_progress(target_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.guardian_students gs
    join public.guardians g on g.id = gs.guardian_id
    where g.profile_id = (select auth.uid())
      and gs.student_id = target_student
      and gs.can_view_progress = true
  );
$$;

-- Bootstrap inicial: execute apenas no SQL Editor / contexto de proprietário.
create or replace function public.bootstrap_admin(target_email text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare target_id uuid;
begin
  select id into target_id
  from auth.users
  where lower(email) = lower(target_email)
  limit 1;

  if target_id is null then
    raise exception 'Usuário não encontrado';
  end if;

  insert into public.profiles(id, full_name)
  select id, coalesce(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
  from auth.users where id = target_id
  on conflict (id) do nothing;

  insert into public.user_roles(user_id, role)
  values (target_id, 'admin')
  on conflict do nothing;

  return target_id;
end;
$$;

create or replace function public.bootstrap_teacher(target_email text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare target_id uuid;
begin
  select id into target_id
  from auth.users
  where lower(email) = lower(target_email)
  limit 1;

  if target_id is null then
    raise exception 'Usuário não encontrado';
  end if;

  insert into public.profiles(id, full_name)
  select id, coalesce(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
  from auth.users where id = target_id
  on conflict (id) do nothing;

  insert into public.user_roles(user_id, role)
  values (target_id, 'teacher')
  on conflict do nothing;

  insert into public.teachers(profile_id)
  values (target_id)
  on conflict (profile_id) do update set active = true;

  return target_id;
end;
$$;

revoke execute on function public.bootstrap_admin(text) from public, anon, authenticated;
revoke execute on function public.bootstrap_teacher(text) from public, anon, authenticated;


-- Publicação/atribuição é uma ação protegida: professor precisa ser dono da missão
-- e estar vinculado ao aluno.
create or replace function public.assign_mission_to_student(
  p_mission_id uuid,
  p_student_id uuid,
  p_due_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_teacher_id uuid;
  v_assignment_id uuid;
begin
  v_teacher_id := private.teacher_id_for_user();

  if v_teacher_id is null and not private.has_role('admin') then
    raise exception 'Professor não identificado';
  end if;

  if not private.has_role('admin') then
    if not exists (
      select 1 from public.missions
      where id = p_mission_id
        and created_by_teacher_id = v_teacher_id
    ) then
      raise exception 'Missão não pertence ao professor';
    end if;

    if not private.teacher_has_student(p_student_id) then
      raise exception 'Aluno não está vinculado ao professor';
    end if;
  else
    select created_by_teacher_id into v_teacher_id
    from public.missions
    where id = p_mission_id;
  end if;

  insert into public.mission_students(
    mission_id,
    student_id,
    assigned_by_teacher_id,
    due_at,
    status
  )
  values (
    p_mission_id,
    p_student_id,
    v_teacher_id,
    p_due_at,
    'assigned'
  )
  on conflict (mission_id, student_id) do update set
    assigned_by_teacher_id = excluded.assigned_by_teacher_id,
    due_at = excluded.due_at,
    status = case
      when public.mission_students.status in ('submitted', 'reviewed')
        then public.mission_students.status
      else 'assigned'
    end
  returning id into v_assignment_id;

  update public.missions
  set
    status = 'published',
    published_at = coalesce(published_at, now())
  where id = p_mission_id;

  return v_assignment_id;
end;
$$;

grant execute on function public.assign_mission_to_student(uuid, uuid, timestamptz) to authenticated;

-- Mantém a atribuição sincronizada com a submissão sem permitir que o aluno
-- altere campos administrativos de mission_students diretamente.
create or replace function public.sync_assignment_from_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.mission_students
    set
      status = 'submitted',
      completed_at = coalesce(completed_at, new.submitted_at)
    where id = new.mission_student_id;
  elsif tg_op = 'UPDATE' and new.review_status = 'reviewed' and old.review_status is distinct from new.review_status then
    update public.mission_students
    set status = 'reviewed'
    where id = new.mission_student_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_assignment_submission on public.submissions;
create trigger trg_sync_assignment_submission
after insert or update of review_status on public.submissions
for each row execute function public.sync_assignment_from_submission();

-- Recalcula a habilidade com até 8 evidências recentes.
create or replace function public.recalculate_student_skill_state(
  p_student_id uuid,
  p_skill_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_count integer := 0;
  v_domain smallint := 0;
  v_autonomy smallint := 0;
  v_std numeric := 0;
  v_confidence public.confidence_level := 'low';
  v_recent numeric;
  v_previous numeric;
  v_trend public.skill_trend := 'stable';
begin
  if not (
    private.has_role('admin')
    or private.teacher_has_student(p_student_id)
  ) then
    raise exception 'Acesso negado';
  end if;

  with ranked as (
    select
      domain_level,
      autonomy_level,
      row_number() over (order by observed_at desc, created_at desc) as rn
    from public.pedagogical_evidence
    where student_id = p_student_id
      and skill_id = p_skill_id
    order by observed_at desc, created_at desc
    limit 8
  ),
  agg as (
    select
      count(*)::integer as evidence_count,
      round(
        sum(domain_level * greatest(1, 9-rn))::numeric
        / nullif(sum(greatest(1, 9-rn)), 0)
      )::smallint as domain_value,
      round(
        sum(autonomy_level * greatest(1, 9-rn))::numeric
        / nullif(sum(greatest(1, 9-rn)), 0)
      )::smallint as autonomy_value,
      coalesce(stddev_pop(domain_level), 0) as domain_std
    from ranked
  )
  select
    coalesce(evidence_count, 0),
    coalesce(domain_value, 0),
    coalesce(autonomy_value, 0),
    coalesce(domain_std, 0)
  into v_count, v_domain, v_autonomy, v_std
  from agg;

  if v_count <= 2 then
    v_confidence := 'low';
  elsif v_count >= 5 and v_std <= 1 then
    v_confidence := 'high';
  else
    v_confidence := 'medium';
  end if;

  with seq as (
    select
      domain_level,
      row_number() over (order by observed_at desc, created_at desc) rn
    from public.pedagogical_evidence
    where student_id = p_student_id
      and skill_id = p_skill_id
    order by observed_at desc, created_at desc
    limit 6
  )
  select
    avg(domain_level) filter (where rn between 1 and 3),
    avg(domain_level) filter (where rn between 4 and 6)
  into v_recent, v_previous
  from seq;

  if v_previous is null or v_recent is null then
    v_trend := 'stable';
  elsif v_recent >= v_previous + 0.5 then
    v_trend := 'improving';
  elsif v_recent <= v_previous - 0.5 then
    v_trend := 'attention';
  else
    v_trend := 'stable';
  end if;

  insert into public.student_skill_states(
    student_id, skill_id, domain_level, autonomy_level,
    confidence, trend, evidence_count, updated_at
  )
  values (
    p_student_id, p_skill_id, v_domain, v_autonomy,
    v_confidence, v_trend, v_count, now()
  )
  on conflict (student_id, skill_id) do update set
    domain_level = excluded.domain_level,
    autonomy_level = excluded.autonomy_level,
    confidence = excluded.confidence,
    trend = excluded.trend,
    evidence_count = excluded.evidence_count,
    updated_at = now();

  insert into public.student_skill_state_history(
    student_id, skill_id, domain_level, autonomy_level,
    confidence, trend, evidence_count
  )
  values (
    p_student_id, p_skill_id, v_domain, v_autonomy,
    v_confidence, v_trend, v_count
  );
end;
$$;

grant execute on function public.recalculate_student_skill_state(uuid, uuid) to authenticated;
