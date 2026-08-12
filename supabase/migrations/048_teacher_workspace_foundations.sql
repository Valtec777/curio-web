-- CURIÓ · área do Professor: conforto operacional sem criar fluxos paralelos.

alter table public.missions
  add column if not exists description text,
  add column if not exists grade_id uuid references public.grades(id) on delete set null,
  add column if not exists character_id uuid references public.characters(id) on delete set null;

alter table public.materials
  add column if not exists publish_at timestamptz;

alter table public.notebook_activities
  add column if not exists publish_at timestamptz;

alter table public.assessments
  add column if not exists file_path text;

alter table public.teacher_availability
  add column if not exists weekly_slots jsonb not null default '[]'::jsonb;

alter table public.agenda_events drop constraint if exists agenda_events_event_type_check;
alter table public.agenda_events
  add constraint agenda_events_event_type_check
  check (event_type = any (array['meeting','family_meeting','review','assessment','deadline','reminder','class','other']::text[]));

alter table public.agenda_events drop constraint if exists agenda_events_status_check;
alter table public.agenda_events
  add constraint agenda_events_status_check
  check (status = any (array['scheduled','confirmed','completed','cancelled']::text[]));

create index if not exists missions_grade_idx on public.missions(grade_id);
create index if not exists missions_character_idx on public.missions(character_id);
create index if not exists materials_publish_at_idx on public.materials(publish_at) where status = 'published';
create index if not exists notebook_publish_at_idx on public.notebook_activities(publish_at) where status = 'published';

-- O professor pode manter a própria disponibilidade, sem ganhar acesso à agenda de outro professor.
drop policy if exists teacher_availability_teacher_insert on public.teacher_availability;
create policy teacher_availability_teacher_insert on public.teacher_availability
for insert to authenticated
with check (private.has_role('teacher'::public.app_role) and teacher_id = private.teacher_id_for_user());

drop policy if exists teacher_availability_teacher_update on public.teacher_availability;
create policy teacher_availability_teacher_update on public.teacher_availability
for update to authenticated
using (private.has_role('teacher'::public.app_role) and teacher_id = private.teacher_id_for_user())
with check (private.has_role('teacher'::public.app_role) and teacher_id = private.teacher_id_for_user());

drop policy if exists teacher_availability_teacher_delete on public.teacher_availability;
create policy teacher_availability_teacher_delete on public.teacher_availability
for delete to authenticated
using (private.has_role('teacher'::public.app_role) and teacher_id = private.teacher_id_for_user());

-- Publicação programada: aluno/família só recebem o material quando o horário chegar.
create or replace function private.can_read_material(target_material uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.materials m
    where m.id = target_material
      and m.status = 'published'
      and (m.publish_at is null or m.publish_at <= now())
      and exists (
        select 1
        from public.material_assignments ma
        where ma.material_id = m.id
          and (
            (ma.student_id is not null and (
              exists (
                select 1 from public.students s
                where s.id = ma.student_id
                  and s.deleted_at is null
                  and s.auth_user_id = (select auth.uid())
              )
              or exists (
                select 1
                from public.guardian_students gs
                join public.guardians g on g.id = gs.guardian_id
                join public.students s on s.id = gs.student_id
                where gs.student_id = ma.student_id
                  and g.profile_id = (select auth.uid())
                  and g.active = true
                  and s.deleted_at is null
              )
            ))
            or (ma.class_id is not null and exists (
              select 1
              from public.class_students cs
              join public.students s on s.id = cs.student_id
              where cs.class_id = ma.class_id
                and cs.active = true
                and s.deleted_at is null
                and (
                  s.auth_user_id = (select auth.uid())
                  or exists (
                    select 1 from public.guardian_students gs
                    join public.guardians g on g.id = gs.guardian_id
                    where gs.student_id = s.id
                      and g.profile_id = (select auth.uid())
                      and g.active = true
                  )
                )
            ))
            or (ma.pedagogical_group_id is not null and exists (
              select 1
              from public.pedagogical_group_students pgs
              join public.students s on s.id = pgs.student_id
              where pgs.group_id = ma.pedagogical_group_id
                and s.deleted_at is null
                and (
                  s.auth_user_id = (select auth.uid())
                  or exists (
                    select 1 from public.guardian_students gs
                    join public.guardians g on g.id = gs.guardian_id
                    where gs.student_id = s.id
                      and g.profile_id = (select auth.uid())
                      and g.active = true
                  )
                )
            ))
          )
      )
  );
$$;

-- A própria atribuição também fica escondida do aluno/família antes do horário programado.
drop policy if exists material_assignments_select on public.material_assignments;
create policy material_assignments_select on public.material_assignments
for select to authenticated
using (
  private.has_role('admin'::public.app_role)
  or assigned_by_teacher_id = private.teacher_id_for_user()
  or (
    exists (
      select 1 from public.materials m
      where m.id = material_assignments.material_id
        and m.status = 'published'
        and (m.publish_at is null or m.publish_at <= now())
    )
    and (
      (student_id is not null and (
        student_id in (select s.id from public.students s where s.auth_user_id = (select auth.uid()) and s.deleted_at is null)
        or private.guardian_has_student(student_id)
      ))
      or (class_id is not null and (
        private.teacher_has_class(class_id)
        or exists (
          select 1 from public.class_students cs
          where cs.class_id = material_assignments.class_id
            and cs.active = true
            and (
              cs.student_id in (select s.id from public.students s where s.auth_user_id = (select auth.uid()) and s.deleted_at is null)
              or private.guardian_has_student(cs.student_id)
            )
        )
      ))
    )
  )
);

drop policy if exists notebook_activities_read on public.notebook_activities;
create policy notebook_activities_read on public.notebook_activities
for select to authenticated
using (
  private.has_role('admin'::public.app_role)
  or created_by_teacher_id = private.teacher_id_for_user()
  or (status = 'published' and (publish_at is null or publish_at <= now()))
);

drop policy if exists notebook_assignments_select on public.notebook_assignments;
create policy notebook_assignments_select on public.notebook_assignments
for select to authenticated
using (
  private.has_role('admin'::public.app_role)
  or private.teacher_has_student(student_id)
  or (
    exists (
      select 1 from public.notebook_activities na
      where na.id = notebook_assignments.activity_id
        and na.status = 'published'
        and (na.publish_at is null or na.publish_at <= now())
    )
    and (
      private.guardian_can_view_progress(student_id)
      or student_id in (select s.id from public.students s where s.auth_user_id = (select auth.uid()) and s.deleted_at is null)
    )
  )
);

-- Arquivos pedagógicos do professor e foto de perfil.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'teacher-materials','teacher-materials',false,15728640,
  array['application/pdf','image/png','image/jpeg','image/webp']::text[]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'profile-avatars','profile-avatars',false,5242880,
  array['image/png','image/jpeg','image/webp']::text[]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Arquivos do professor ficam em pasta própria: <auth.uid()>/...
drop policy if exists teacher_materials_owner_select on storage.objects;
create policy teacher_materials_owner_select on storage.objects
for select to authenticated
using (
  bucket_id = 'teacher-materials'
  and (
    private.has_role('admin'::public.app_role)
    or (storage.foldername(name))[1] = (select auth.uid())::text
  )
);

drop policy if exists teacher_materials_owner_insert on storage.objects;
create policy teacher_materials_owner_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'teacher-materials'
  and private.has_role('teacher'::public.app_role)
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists teacher_materials_owner_update on storage.objects;
create policy teacher_materials_owner_update on storage.objects
for update to authenticated
using (bucket_id = 'teacher-materials' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'teacher-materials' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists teacher_materials_owner_delete on storage.objects;
create policy teacher_materials_owner_delete on storage.objects
for delete to authenticated
using (bucket_id = 'teacher-materials' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists profile_avatars_owner_select on storage.objects;
create policy profile_avatars_owner_select on storage.objects
for select to authenticated
using (
  bucket_id = 'profile-avatars'
  and (
    private.has_role('admin'::public.app_role)
    or (storage.foldername(name))[1] = (select auth.uid())::text
  )
);

drop policy if exists profile_avatars_owner_insert on storage.objects;
create policy profile_avatars_owner_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists profile_avatars_owner_update on storage.objects;
create policy profile_avatars_owner_update on storage.objects
for update to authenticated
using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists profile_avatars_owner_delete on storage.objects;
create policy profile_avatars_owner_delete on storage.objects
for delete to authenticated
using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Publicação de uma missão para vários alunos em uma única operação.
create or replace function public.assign_mission_to_students(
  p_mission_id uuid,
  p_student_ids uuid[],
  p_due_at timestamptz default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teacher_id uuid := private.teacher_id_for_user();
  v_student_id uuid;
  v_count integer := 0;
begin
  if v_teacher_id is null then raise exception 'teacher profile required'; end if;
  if not exists (
    select 1 from public.missions m
    where m.id = p_mission_id and m.created_by_teacher_id = v_teacher_id and m.status <> 'archived'
  ) then raise exception 'mission unavailable'; end if;
  if coalesce(array_length(p_student_ids,1),0) = 0 then raise exception 'select at least one student'; end if;

  foreach v_student_id in array p_student_ids loop
    if not private.teacher_has_student(v_student_id) then
      raise exception 'student is not linked to this teacher';
    end if;
  end loop;

  foreach v_student_id in array p_student_ids loop
    insert into public.mission_students(mission_id,student_id,assigned_by_teacher_id,due_at,status)
    values(p_mission_id,v_student_id,v_teacher_id,p_due_at,'assigned')
    on conflict (mission_id,student_id) do update set
      due_at = excluded.due_at,
      assigned_by_teacher_id = excluded.assigned_by_teacher_id;
    v_count := v_count + 1;
  end loop;

  update public.missions
  set status='published', published_at=coalesce(published_at,now()), updated_at=now()
  where id=p_mission_id and created_by_teacher_id=v_teacher_id;

  return v_count;
end;
$$;

revoke all on function public.assign_mission_to_students(uuid,uuid[],timestamptz) from public, anon;
grant execute on function public.assign_mission_to_students(uuid,uuid[],timestamptz) to authenticated;

-- Duplicação preserva questões e gabarito, mas nunca reaproveita os alunos atribuídos.
create or replace function public.duplicate_teacher_mission(p_mission_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teacher_id uuid := private.teacher_id_for_user();
  v_new_id uuid;
  v_q record;
  v_new_q uuid;
begin
  if v_teacher_id is null then raise exception 'teacher profile required'; end if;
  if not exists (select 1 from public.missions m where m.id=p_mission_id and m.created_by_teacher_id=v_teacher_id) then
    raise exception 'mission unavailable';
  end if;

  insert into public.missions(
    created_by_teacher_id,title,objective,description,subject_id,content_id,grade_id,character_id,
    estimated_minutes,status,published_at,idempotency_key,request_day
  )
  select
    created_by_teacher_id,title || ' — cópia',objective,description,subject_id,content_id,grade_id,character_id,
    estimated_minutes,'draft',null,null,(now() at time zone 'America/Bahia')::date
  from public.missions where id=p_mission_id
  returning id into v_new_id;

  for v_q in
    select q.* from public.mission_questions q where q.mission_id=p_mission_id order by q.position
  loop
    insert into public.mission_questions(mission_id,position,prompt,hint,question_type,primary_skill_id,options)
    values(v_new_id,v_q.position,v_q.prompt,v_q.hint,v_q.question_type,v_q.primary_skill_id,v_q.options)
    returning id into v_new_q;

    insert into public.mission_question_answer_keys(question_id,correct_value,explanation)
    select v_new_q,k.correct_value,k.explanation
    from public.mission_question_answer_keys k where k.question_id=v_q.id;
  end loop;

  return v_new_id;
end;
$$;

revoke all on function public.duplicate_teacher_mission(uuid) from public, anon;
grant execute on function public.duplicate_teacher_mission(uuid) to authenticated;

-- O professor edita os próprios dados profissionais sem ganhar permissão para ativar/desativar a própria conta.
create or replace function public.update_teacher_self_profile(
  p_full_name text,
  p_preferred_name text,
  p_phone text,
  p_professional_description text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_teacher_id uuid := private.teacher_id_for_user();
begin
  if v_user_id is null or v_teacher_id is null then raise exception 'teacher profile required'; end if;
  if nullif(btrim(p_full_name),'') is null then raise exception 'full name required'; end if;

  update public.profiles
  set full_name=btrim(p_full_name),
      preferred_name=nullif(btrim(coalesce(p_preferred_name,'')),''),
      phone_whatsapp=nullif(btrim(coalesce(p_phone,'')),''),
      updated_at=now()
  where id=v_user_id;

  update public.teachers
  set phone_whatsapp=nullif(btrim(coalesce(p_phone,'')),''),
      professional_description=nullif(btrim(coalesce(p_professional_description,'')), '')
  where id=v_teacher_id and profile_id=v_user_id;
end;
$$;

revoke all on function public.update_teacher_self_profile(text,text,text,text) from public, anon;
grant execute on function public.update_teacher_self_profile(text,text,text,text) to authenticated;
