-- CURIÓ · exclusão/restauração de aluno em uma única operação.
-- Preserva o mesmo ID e histórico, desativa vínculos de professor na Lixeira
-- e restaura somente os vínculos que estavam ativos antes da remoção.

create or replace function public.move_admin_student_to_trash(
  p_student_id uuid,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_student public.students%rowtype;
  v_reason text;
  v_now timestamptz := now();
  v_trash_id uuid;
  v_active_teacher_ids jsonb := '[]'::jsonb;
  v_invitation_states jsonb := '[]'::jsonb;
  v_teacher_count integer := 0;
  v_guardian_count integer := 0;
  v_mission_count integer := 0;
  v_assessment_count integer := 0;
  v_snapshot jsonb;
begin
  if v_user_id is null or not private.has_role('admin'::public.app_role) then
    raise exception 'admin required';
  end if;

  select * into v_student
  from public.students
  where id = p_student_id
  for update;

  if not found then raise exception 'student not found'; end if;
  if v_student.deleted_at is not null then raise exception 'student already trashed'; end if;

  v_reason := coalesce(nullif(btrim(p_reason), ''), 'Removido pelo Admin');

  select
    coalesce(jsonb_agg(to_jsonb(ts.teacher_id)) filter (where ts.active), '[]'::jsonb),
    count(*)::integer
  into v_active_teacher_ids, v_teacher_count
  from public.teacher_students ts
  where ts.student_id = p_student_id;

  select count(*)::integer into v_guardian_count
  from public.guardian_students gs where gs.student_id = p_student_id;

  select count(*)::integer into v_mission_count
  from public.mission_students ms where ms.student_id = p_student_id;

  select count(*)::integer into v_assessment_count
  from public.assessment_students a where a.student_id = p_student_id;

  select coalesce(
    jsonb_agg(jsonb_build_object('id', ai.id, 'status', ai.status))
      filter (where ai.status in ('pending','sent')),
    '[]'::jsonb
  )
  into v_invitation_states
  from public.access_invitations ai
  where ai.student_id = p_student_id and ai.deleted_at is null;

  v_snapshot := jsonb_build_object(
    'label', coalesce(v_student.preferred_name, v_student.full_name),
    'full_name', v_student.full_name,
    'school_name', v_student.school_name,
    'grade_id', v_student.grade_id,
    'previous_status', v_student.status,
    'reason', v_reason,
    'active_teacher_ids', v_active_teacher_ids,
    'invitation_states', v_invitation_states,
    'dependencies', jsonb_build_object(
      'teacher_students', v_teacher_count,
      'guardian_students', v_guardian_count,
      'mission_students', v_mission_count,
      'assessment_students', v_assessment_count
    )
  );

  select ti.id into v_trash_id
  from public.trash_items ti
  where ti.entity_type = 'students'
    and ti.entity_id = p_student_id
    and ti.restored_at is null
  order by ti.deleted_at desc
  limit 1
  for update;

  if v_trash_id is null then
    insert into public.trash_items(
      entity_type, entity_id, entity_snapshot, deleted_by_user_id,
      deleted_at, restore_until, restored_at
    ) values (
      'students', p_student_id, v_snapshot, v_user_id,
      v_now, v_now + interval '30 days', null
    ) returning id into v_trash_id;
  else
    update public.trash_items
    set entity_snapshot = v_snapshot,
        deleted_by_user_id = v_user_id,
        deleted_at = v_now,
        restore_until = v_now + interval '30 days',
        restored_at = null
    where id = v_trash_id;
  end if;

  update public.teacher_students
  set active = false
  where student_id = p_student_id and active = true;

  update public.students
  set status = 'inactive'::public.student_status,
      deleted_at = v_now,
      deleted_by_user_id = v_user_id,
      delete_reason = v_reason,
      updated_at = v_now
  where id = p_student_id;

  return v_trash_id;
end;
$$;

create or replace function public.restore_admin_student_from_trash(p_trash_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_item public.trash_items%rowtype;
  v_snapshot jsonb;
  v_student_id uuid;
  v_previous_status text;
  v_teacher_text text;
  v_invitation jsonb;
begin
  if v_user_id is null or not private.has_role('admin'::public.app_role) then
    raise exception 'admin required';
  end if;

  select * into v_item
  from public.trash_items
  where id = p_trash_id
  for update;

  if not found or v_item.entity_type <> 'students' or v_item.entity_id is null then
    raise exception 'student trash item not found';
  end if;
  if v_item.restored_at is not null then raise exception 'student already restored'; end if;
  if v_item.restore_until is not null and v_item.restore_until < now() then
    raise exception 'restore period expired';
  end if;

  v_student_id := v_item.entity_id;
  v_snapshot := coalesce(v_item.entity_snapshot, '{}'::jsonb);
  v_previous_status := coalesce(v_snapshot->>'previous_status', 'inactive');
  if v_previous_status not in ('active','paused','inactive','pilot') then
    v_previous_status := 'inactive';
  end if;

  update public.students
  set deleted_at = null,
      deleted_by_user_id = null,
      delete_reason = null,
      status = v_previous_status::public.student_status,
      updated_at = now()
  where id = v_student_id;

  if not found then raise exception 'student record no longer exists'; end if;

  for v_teacher_text in
    select value
    from jsonb_array_elements_text(coalesce(v_snapshot->'active_teacher_ids', '[]'::jsonb))
  loop
    if v_teacher_text ~* '^[0-9a-f-]{36}$' then
      update public.teacher_students ts
      set active = true
      from public.teachers t
      where ts.student_id = v_student_id
        and ts.teacher_id = v_teacher_text::uuid
        and t.id = ts.teacher_id
        and t.active = true;
    end if;
  end loop;

  for v_invitation in
    select value
    from jsonb_array_elements(coalesce(v_snapshot->'invitation_states', '[]'::jsonb))
  loop
    if coalesce(v_invitation->>'status','') in ('pending','sent')
       and coalesce(v_invitation->>'id','') ~* '^[0-9a-f-]{36}$' then
      update public.access_invitations
      set status = v_invitation->>'status',
          last_error = null,
          updated_at = now()
      where id = (v_invitation->>'id')::uuid
        and student_id = v_student_id
        and deleted_at is null
        and status = 'cancelled';
    end if;
  end loop;

  update public.trash_items set restored_at = now() where id = v_item.id;
  return v_student_id;
end;
$$;

revoke all on function public.move_admin_student_to_trash(uuid,text) from public, anon;
revoke all on function public.restore_admin_student_from_trash(uuid) from public, anon;
grant execute on function public.move_admin_student_to_trash(uuid,text) to authenticated;
grant execute on function public.restore_admin_student_from_trash(uuid) to authenticated;

comment on function public.move_admin_student_to_trash(uuid,text) is
'Atomically snapshots an active student, deactivates teacher links and soft-deletes the student for 30-day restoration. Admin only.';
comment on function public.restore_admin_student_from_trash(uuid) is
'Atomically restores a trashed student with the same ID, previous status, previously active teacher links and pending/sent invitation states. Admin only.';
