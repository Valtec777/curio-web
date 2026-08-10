-- CURIÓ · área da Família: seleção por criança, arquivos escolares, avaliações informadas,
-- chat com professor, entregas de caderno, interesse mensal e assinatura interna de contrato.

create table if not exists public.family_school_uploads (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  title text not null,
  content_type text not null default 'school_material' check (content_type in ('school_material','notebook_photo','school_notice','assignment','assessment_notice','other')),
  description text,
  related_date date,
  file_path text not null,
  file_name text not null,
  mime_type text,
  status text not null default 'received' check (status in ('received','reviewing','linked','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_family_school_uploads_student_created on public.family_school_uploads(student_id, created_at desc);
create index if not exists idx_family_school_uploads_guardian_created on public.family_school_uploads(guardian_id, created_at desc);

alter table public.family_school_uploads enable row level security;

drop policy if exists family_school_uploads_select on public.family_school_uploads;
create policy family_school_uploads_select on public.family_school_uploads
for select to authenticated
using (
  private.has_role('admin'::public.app_role)
  or guardian_id = private.guardian_id_for_user()
  or private.teacher_has_student(student_id)
);

drop policy if exists family_school_uploads_insert on public.family_school_uploads;
create policy family_school_uploads_insert on public.family_school_uploads
for insert to authenticated
with check (
  guardian_id = private.guardian_id_for_user()
  and private.guardian_has_student(student_id)
);

drop policy if exists family_school_uploads_team_update on public.family_school_uploads;
create policy family_school_uploads_team_update on public.family_school_uploads
for update to authenticated
using (private.has_role('admin'::public.app_role) or private.teacher_has_student(student_id))
with check (private.has_role('admin'::public.app_role) or private.teacher_has_student(student_id));

create table if not exists public.family_assessment_reports (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  origin text not null default 'guardian' check (origin in ('guardian','school')),
  title text not null,
  assessment_date date not null,
  content text,
  observations text,
  file_path text,
  file_name text,
  mime_type text,
  status text not null default 'reported' check (status in ('reported','reviewing','linked','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_family_assessment_reports_student_date on public.family_assessment_reports(student_id, assessment_date desc);

alter table public.family_assessment_reports enable row level security;

drop policy if exists family_assessment_reports_select on public.family_assessment_reports;
create policy family_assessment_reports_select on public.family_assessment_reports
for select to authenticated
using (
  private.has_role('admin'::public.app_role)
  or guardian_id = private.guardian_id_for_user()
  or private.teacher_has_student(student_id)
);

drop policy if exists family_assessment_reports_insert on public.family_assessment_reports;
create policy family_assessment_reports_insert on public.family_assessment_reports
for insert to authenticated
with check (
  guardian_id = private.guardian_id_for_user()
  and private.guardian_has_student(student_id)
);

drop policy if exists family_assessment_reports_team_update on public.family_assessment_reports;
create policy family_assessment_reports_team_update on public.family_assessment_reports
for update to authenticated
using (private.has_role('admin'::public.app_role) or private.teacher_has_student(student_id))
with check (private.has_role('admin'::public.app_role) or private.teacher_has_student(student_id));

create table if not exists public.learning_interest_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('teacher','guardian','student')),
  response_month date not null,
  interest_text text,
  dismissed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, role, response_month)
);

alter table public.learning_interest_responses enable row level security;

drop policy if exists learning_interest_self_select on public.learning_interest_responses;
create policy learning_interest_self_select on public.learning_interest_responses
for select to authenticated
using (user_id = (select auth.uid()) or private.has_role('admin'::public.app_role));

drop policy if exists learning_interest_self_insert on public.learning_interest_responses;
create policy learning_interest_self_insert on public.learning_interest_responses
for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists learning_interest_self_update on public.learning_interest_responses;
create policy learning_interest_self_update on public.learning_interest_responses
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

alter table public.notebook_assignments
  add column if not exists guardian_note text,
  add column if not exists submitted_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists needs_redo boolean not null default false,
  add column if not exists redo_note text;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'family-uploads',
  'family-uploads',
  false,
  15728640,
  array['application/pdf','image/png','image/jpeg','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists family_uploads_owner_insert on storage.objects;
create policy family_uploads_owner_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'family-uploads'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists family_uploads_select on storage.objects;
create policy family_uploads_select on storage.objects
for select to authenticated
using (
  bucket_id = 'family-uploads'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or private.has_role('admin'::public.app_role)
    or exists (
      select 1 from public.family_school_uploads u
      where u.file_path = name and private.teacher_has_student(u.student_id)
    )
    or exists (
      select 1 from public.family_assessment_reports r
      where r.file_path = name and private.teacher_has_student(r.student_id)
    )
    or exists (
      select 1 from public.notebook_assignments n
      where n.submission_photo_path = name and private.teacher_has_student(n.student_id)
    )
  )
);

drop policy if exists family_uploads_owner_delete on storage.objects;
create policy family_uploads_owner_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'family-uploads'
  and ((storage.foldername(name))[1] = (select auth.uid())::text or private.has_role('admin'::public.app_role))
);

create or replace function public.guardian_child_overview()
returns table(
  student_id uuid,
  student_name text,
  full_name text,
  school_name text,
  student_status text,
  grade_name text,
  relationship text,
  can_view_progress boolean,
  teacher_id uuid,
  teacher_user_id uuid,
  teacher_name text,
  tracked_subjects text[]
)
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select s.id,
         coalesce(s.preferred_name, s.full_name, 'Criança'),
         s.full_name,
         s.school_name,
         s.status::text,
         gr.name,
         coalesce(gs.relationship, 'Responsável'),
         gs.can_view_progress,
         t.id,
         t.profile_id,
         coalesce(tp.preferred_name, tp.full_name, 'Professor(a)'),
         coalesce(slp.tracked_subjects, '{}'::text[])
  from public.guardians g
  join public.guardian_students gs on gs.guardian_id = g.id
  join public.students s on s.id = gs.student_id and s.deleted_at is null
  left join public.grades gr on gr.id = s.grade_id
  left join public.student_learning_profiles slp on slp.student_id = s.id
  left join lateral (
    select ts.teacher_id
    from public.teacher_students ts
    where ts.student_id = s.id and ts.active = true
    order by ts.created_at
    limit 1
  ) ts on true
  left join public.teachers t on t.id = ts.teacher_id and t.active = true
  left join public.profiles tp on tp.id = t.profile_id
  where g.profile_id = (select auth.uid())
    and g.active = true
    and private.has_role('guardian'::public.app_role)
  order by s.preferred_name, s.full_name;
$$;

revoke all on function public.guardian_child_overview() from public, anon;
grant execute on function public.guardian_child_overview() to authenticated;

create or replace function public.guardian_chat_targets()
returns table(
  student_id uuid,
  student_name text,
  teacher_id uuid,
  teacher_user_id uuid,
  teacher_name text
)
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select distinct s.id,
         coalesce(s.preferred_name, s.full_name, 'Aluno'),
         t.id,
         t.profile_id,
         coalesce(p.preferred_name, p.full_name, 'Professor(a)')
  from public.guardians g
  join public.guardian_students gs on gs.guardian_id = g.id
  join public.students s on s.id = gs.student_id and s.deleted_at is null
  join public.teacher_students ts on ts.student_id = s.id and ts.active = true
  join public.teachers t on t.id = ts.teacher_id and t.active = true
  join public.profiles p on p.id = t.profile_id
  where g.profile_id = (select auth.uid())
    and g.active = true
    and private.has_role('guardian'::public.app_role)
  order by coalesce(s.preferred_name, s.full_name, 'Aluno'), coalesce(p.preferred_name, p.full_name, 'Professor(a)');
$$;

revoke all on function public.guardian_chat_targets() from public, anon;
grant execute on function public.guardian_chat_targets() to authenticated;

create or replace function public.send_guardian_teacher_chat_message(
  p_thread_id uuid,
  p_student_id uuid,
  p_teacher_id uuid,
  p_body text,
  p_request_key text
)
returns table(thread_id uuid, message_id uuid, reused boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sender uuid := auth.uid();
  v_guardian_id uuid;
  v_teacher_user_id uuid;
  v_thread_id uuid;
  v_message_id uuid;
  v_body text := btrim(coalesce(p_body, ''));
  v_request_key text := nullif(btrim(coalesce(p_request_key, '')), '');
  v_student_name text;
begin
  if v_sender is null then raise exception 'authentication required'; end if;
  if not private.has_role('guardian'::public.app_role) then raise exception 'guardian role required'; end if;
  v_guardian_id := private.guardian_id_for_user();
  if v_guardian_id is null then raise exception 'guardian profile required'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 5000 then raise exception 'invalid body'; end if;
  if v_request_key is null or char_length(v_request_key) < 8 or char_length(v_request_key) > 160 then raise exception 'invalid request key'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('curio-guardian-chat-request:' || v_sender::text || ':' || v_request_key, 0));

  select m.thread_id, m.id into v_thread_id, v_message_id
  from public.messages m
  where m.sender_user_id = v_sender and m.request_key = v_request_key
  limit 1;
  if v_message_id is not null then
    return query select v_thread_id, v_message_id, true;
    return;
  end if;

  if p_thread_id is not null then
    select mt.id into v_thread_id
    from public.message_threads mt
    join public.message_thread_participants mp on mp.thread_id = mt.id and mp.user_id = v_sender
    where mt.id = p_thread_id
      and mt.thread_type = 'family'
      and mt.context_student_id is not null
      and private.guardian_has_student(mt.context_student_id)
    limit 1;
    if v_thread_id is null then raise exception 'thread unavailable'; end if;
  else
    if p_student_id is null or p_teacher_id is null then raise exception 'target required'; end if;
    if not private.guardian_has_student(p_student_id) then raise exception 'student unavailable'; end if;

    select t.profile_id into v_teacher_user_id
    from public.teachers t
    join public.teacher_students ts on ts.teacher_id = t.id
    where t.id = p_teacher_id
      and t.active = true
      and ts.student_id = p_student_id
      and ts.active = true
    limit 1;
    if v_teacher_user_id is null then raise exception 'teacher unavailable'; end if;

    select coalesce(s.preferred_name, s.full_name, 'Aluno') into v_student_name
    from public.students s where s.id = p_student_id and s.deleted_at is null;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('curio-family-teacher-thread:' || v_sender::text || ':' || v_teacher_user_id::text || ':' || p_student_id::text, 0)
    );

    select mt.id into v_thread_id
    from public.message_threads mt
    where mt.thread_type = 'family'
      and mt.context_student_id = p_student_id
      and exists (select 1 from public.message_thread_participants mp where mp.thread_id = mt.id and mp.user_id = v_sender)
      and exists (select 1 from public.message_thread_participants mp where mp.thread_id = mt.id and mp.user_id = v_teacher_user_id)
      and 2 = (select count(*) from public.message_thread_participants mp where mp.thread_id = mt.id)
    order by mt.created_at
    limit 1;

    if v_thread_id is null then
      insert into public.message_threads(subject, thread_type, context_student_id)
      values ('Conversa sobre ' || coalesce(v_student_name, 'aluno'), 'family', p_student_id)
      returning id into v_thread_id;

      insert into public.message_thread_participants(thread_id, user_id)
      values (v_thread_id, v_sender), (v_thread_id, v_teacher_user_id)
      on conflict on constraint message_thread_participants_pkey do nothing;
    end if;
  end if;

  insert into public.messages(thread_id, sender_user_id, body, request_key)
  values (v_thread_id, v_sender, v_body, v_request_key)
  on conflict (sender_user_id, request_key) where request_key is not null
  do update set request_key = excluded.request_key
  returning id into v_message_id;

  update public.message_threads set updated_at = now() where id = v_thread_id;
  return query select v_thread_id, v_message_id, false;
end;
$$;

revoke all on function public.send_guardian_teacher_chat_message(uuid,uuid,uuid,text,text) from public, anon;
grant execute on function public.send_guardian_teacher_chat_message(uuid,uuid,uuid,text,text) to authenticated;

create or replace function public.submit_guardian_notebook_assignment(
  p_assignment_id uuid,
  p_file_path text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_assignment public.notebook_assignments%rowtype;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if not private.has_role('guardian'::public.app_role) then raise exception 'guardian role required'; end if;
  if p_file_path is null or char_length(btrim(p_file_path)) < 3 then raise exception 'file required'; end if;

  select n.* into v_assignment
  from public.notebook_assignments n
  join public.notebook_activities a on a.id = n.activity_id
  where n.id = p_assignment_id
    and a.status = 'published'
    and (a.publish_at is null or a.publish_at <= now())
    and private.guardian_has_student(n.student_id)
  limit 1;
  if v_assignment.id is null then raise exception 'assignment unavailable'; end if;

  update public.notebook_assignments
  set submission_photo_path = btrim(p_file_path),
      guardian_note = nullif(btrim(coalesce(p_note, '')), ''),
      submitted_by_user_id = v_user,
      submitted_at = now(),
      status = 'submitted',
      needs_redo = false,
      redo_note = null,
      updated_at = now()
  where id = v_assignment.id;

  return v_assignment.id;
end;
$$;

revoke all on function public.submit_guardian_notebook_assignment(uuid,text,text) from public, anon;
grant execute on function public.submit_guardian_notebook_assignment(uuid,text,text) to authenticated;

create or replace function public.sign_guardian_contract(p_contract_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_guardian uuid;
  v_updated integer;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if not private.has_role('guardian'::public.app_role) then raise exception 'guardian role required'; end if;
  v_guardian := private.guardian_id_for_user();
  if v_guardian is null then raise exception 'guardian profile required'; end if;

  update public.contracts c
  set status = 'signed', signed_by_user_id = v_user, signed_at = now(), updated_at = now()
  from public.subscriptions s
  where c.id = p_contract_id
    and s.id = c.subscription_id
    and s.guardian_id = v_guardian
    and c.status = 'sent'
    and c.document_path is not null;
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.sign_guardian_contract(uuid) from public, anon;
grant execute on function public.sign_guardian_contract(uuid) to authenticated;
