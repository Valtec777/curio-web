-- CURIÓ · ao reenviar uma atividade pedida para refazer, a correção anterior não pode parecer atual.

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
      score = null,
      teacher_note = null,
      stars_awarded = 0,
      needs_redo = false,
      redo_note = null,
      updated_at = now()
  where id = v_assignment.id;

  return v_assignment.id;
end;
$$;

revoke all on function public.submit_guardian_notebook_assignment(uuid,text,text) from public, anon;
grant execute on function public.submit_guardian_notebook_assignment(uuid,text,text) to authenticated;
