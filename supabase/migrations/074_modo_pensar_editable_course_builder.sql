-- CURIÓ · Modo Pensar editável por etapas e blocos

alter table public.free_courses
  add column if not exists category text,
  add column if not exists age_label text,
  add column if not exists level_label text,
  add column if not exists objective text,
  add column if not exists character_id uuid references public.characters(id) on delete set null,
  add column if not exists sort_order integer not null default 0,
  add column if not exists certificate_config jsonb not null default '{}'::jsonb;

alter table public.free_courses drop constraint if exists free_courses_status_check;
alter table public.free_courses
  add constraint free_courses_status_check check (status in ('draft','published','hidden','archived'));

alter table public.free_course_modules
  add column if not exists status text not null default 'published';
alter table public.free_course_modules drop constraint if exists free_course_modules_status_check;
alter table public.free_course_modules
  add constraint free_course_modules_status_check check (status in ('draft','published','hidden','archived'));

create table if not exists public.free_course_module_blocks (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.free_course_modules(id) on delete cascade,
  block_type text not null default 'text' check (block_type in ('text','image','video','link','download','quiz','activity','button')),
  title text,
  body text,
  external_url text,
  file_path text,
  linked_mission_id uuid references public.missions(id) on delete set null,
  position integer not null default 1 check (position > 0),
  status text not null default 'draft' check (status in ('draft','published','hidden','archived')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(module_id, position)
);

create index if not exists free_course_module_blocks_module_position_idx
  on public.free_course_module_blocks(module_id, position);
create index if not exists free_course_module_blocks_linked_mission_idx
  on public.free_course_module_blocks(linked_mission_id) where linked_mission_id is not null;

alter table public.free_course_module_blocks enable row level security;

drop policy if exists free_course_module_blocks_select on public.free_course_module_blocks;
create policy free_course_module_blocks_select on public.free_course_module_blocks for select to authenticated
using (
  exists (
    select 1
    from public.free_course_modules m
    join public.free_courses c on c.id=m.course_id
    where m.id=free_course_module_blocks.module_id
      and (
        private.has_role('admin'::app_role)
        or private.has_role('teacher'::app_role)
        or (c.status='published' and m.status='published' and free_course_module_blocks.status='published')
      )
  )
);

drop policy if exists free_course_module_blocks_admin_write on public.free_course_module_blocks;
create policy free_course_module_blocks_admin_write on public.free_course_module_blocks for all to authenticated
using (private.has_role('admin'::app_role))
with check (private.has_role('admin'::app_role));

drop policy if exists free_course_modules_select on public.free_course_modules;
create policy free_course_modules_select on public.free_course_modules for select to authenticated
using (
  exists (
    select 1 from public.free_courses c
    where c.id=free_course_modules.course_id
      and (
        private.has_role('admin'::app_role)
        or private.has_role('teacher'::app_role)
        or (c.status='published' and free_course_modules.status='published')
      )
  )
);

drop policy if exists generated_documents_modo_pensar_assets on storage.objects;
create policy generated_documents_modo_pensar_assets on storage.objects for select to authenticated
using (
  bucket_id='generated-documents'
  and (
    exists (
      select 1 from public.free_courses c
      where c.cover_image_path=objects.name
        and (private.has_role('admin'::app_role) or private.has_role('teacher'::app_role) or c.status='published')
    )
    or exists (
      select 1
      from public.free_course_module_blocks b
      join public.free_course_modules m on m.id=b.module_id
      join public.free_courses c on c.id=m.course_id
      where b.file_path=objects.name
        and (
          private.has_role('admin'::app_role)
          or private.has_role('teacher'::app_role)
          or (
            c.status='published' and m.status='published' and b.status='published'
            and exists (
              select 1 from public.free_course_enrollments e
              where e.course_id=c.id
                and (
                  e.student_id in (select s.id from public.students s where s.auth_user_id=(select auth.uid()) and s.deleted_at is null)
                  or private.guardian_can_view_progress(e.student_id)
                )
            )
          )
        )
    )
  )
);

create or replace function public.start_free_course(p_course_id uuid, p_student_id uuid)
returns uuid language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_id uuid;
begin
  if not private.can_use_student_context(p_student_id) then raise exception 'not allowed'; end if;
  if not exists(select 1 from public.free_courses c where c.id=p_course_id and c.status='published') then raise exception 'course unavailable'; end if;

  insert into public.free_course_enrollments(course_id,student_id,status,progress_percent)
  values(p_course_id,p_student_id,'in_progress',0)
  on conflict(course_id,student_id) do update set updated_at=now()
  returning id into v_id;

  insert into public.mission_students(mission_id,student_id,assigned_by_teacher_id,status)
  select distinct b.linked_mission_id,p_student_id,m.created_by_teacher_id,'assigned'
  from public.free_course_module_blocks b
  join public.free_course_modules cm on cm.id=b.module_id
  join public.missions m on m.id=b.linked_mission_id
  where cm.course_id=p_course_id
    and cm.status='published'
    and b.status='published'
    and b.linked_mission_id is not null
    and m.status='published'
  on conflict(mission_id,student_id) do nothing;

  return v_id;
end; $$;
revoke all on function public.start_free_course(uuid,uuid) from public,anon;
grant execute on function public.start_free_course(uuid,uuid) to authenticated;

create or replace function public.complete_free_course_module(p_module_id uuid, p_student_id uuid)
returns table(progress_percent smallint, course_completed boolean, certificate_code text)
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  v_course_id uuid; v_enrollment_id uuid; v_required int; v_done int; v_progress smallint; v_completed boolean; v_code text;
begin
  if not private.can_use_student_context(p_student_id) then raise exception 'not allowed'; end if;
  select m.course_id into v_course_id
  from public.free_course_modules m
  join public.free_courses c on c.id=m.course_id
  where m.id=p_module_id and m.status='published' and c.status='published';
  if v_course_id is null then raise exception 'module unavailable'; end if;

  select public.start_free_course(v_course_id,p_student_id) into v_enrollment_id;
  insert into public.free_course_module_progress(enrollment_id,module_id,student_id)
  values(v_enrollment_id,p_module_id,p_student_id)
  on conflict(enrollment_id,module_id) do nothing;

  select count(*) into v_required
  from public.free_course_modules m
  where m.course_id=v_course_id and m.required=true and m.status='published';

  select count(*) into v_done
  from public.free_course_module_progress p
  join public.free_course_modules m on m.id=p.module_id
  where p.enrollment_id=v_enrollment_id and m.required=true and m.status='published';

  v_progress := case when v_required=0 then 100 else least(100,round(v_done*100.0/v_required)::int)::smallint end;
  v_completed := v_progress=100;

  update public.free_course_enrollments
  set progress_percent=v_progress,
      status=case when v_completed then 'completed' else 'in_progress' end,
      completed_at=case when v_completed then coalesce(completed_at,now()) else null end,
      updated_at=now()
  where id=v_enrollment_id;

  if v_completed and exists(select 1 from public.free_courses c where c.id=v_course_id and c.certificate_enabled=true) then
    insert into public.free_course_certificates(enrollment_id,course_id,student_id,certificate_code)
    values(v_enrollment_id,v_course_id,p_student_id,'CURIO-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)))
    on conflict(enrollment_id) do nothing;
    select c.certificate_code into v_code from public.free_course_certificates c where c.enrollment_id=v_enrollment_id;
  end if;

  return query select v_progress,v_completed,v_code;
end; $$;
revoke all on function public.complete_free_course_module(uuid,uuid) from public,anon;
grant execute on function public.complete_free_course_module(uuid,uuid) to authenticated;
