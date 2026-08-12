-- CURIÓ · corrige o enum de status ao vincular Missão/Quiz de uma trilha ao aluno

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
  select distinct b.linked_mission_id,p_student_id,m.created_by_teacher_id,'assigned'::public.assignment_status
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
