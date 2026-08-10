-- CURIÓ · conversas normais Professor ↔ Família/Aluno

create or replace function public.teacher_chat_targets()
returns table(
  student_id uuid,
  student_name text,
  target_kind text,
  target_user_id uuid,
  target_name text,
  guardian_id uuid,
  relationship text
)
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  with teacher_students_visible as (
    select ts.student_id, s.preferred_name, s.full_name, s.auth_user_id
    from public.teacher_students ts
    join public.teachers t on t.id = ts.teacher_id and t.active = true
    join public.students s on s.id = ts.student_id
    where ts.active = true
      and s.deleted_at is null
      and s.status <> 'inactive'
      and t.profile_id = (select auth.uid())
      and private.has_role('teacher'::public.app_role)
  )
  select tsv.student_id,
         coalesce(tsv.preferred_name, tsv.full_name, 'Aluno') as student_name,
         'student'::text as target_kind,
         tsv.auth_user_id as target_user_id,
         coalesce(tsv.preferred_name, tsv.full_name, 'Aluno') as target_name,
         null::uuid as guardian_id,
         null::text as relationship
  from teacher_students_visible tsv
  where tsv.auth_user_id is not null

  union all

  select tsv.student_id,
         coalesce(tsv.preferred_name, tsv.full_name, 'Aluno') as student_name,
         'family'::text as target_kind,
         g.profile_id as target_user_id,
         coalesce(p.preferred_name, p.full_name, 'Responsável') as target_name,
         g.id as guardian_id,
         coalesce(gs.relationship, 'Responsável') as relationship
  from teacher_students_visible tsv
  join public.guardian_students gs on gs.student_id = tsv.student_id
  join public.guardians g on g.id = gs.guardian_id and g.active = true
  join public.profiles p on p.id = g.profile_id;
$$;

revoke all on function public.teacher_chat_targets() from public, anon;
grant execute on function public.teacher_chat_targets() to authenticated;

create or replace function public.send_teacher_chat_message(
  p_thread_id uuid,
  p_target_kind text,
  p_student_id uuid,
  p_guardian_id uuid,
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
  v_teacher_id uuid;
  v_target_user_id uuid;
  v_thread_id uuid;
  v_message_id uuid;
  v_body text := btrim(coalesce(p_body, ''));
  v_request_key text := nullif(btrim(coalesce(p_request_key, '')), '');
  v_student_name text;
begin
  if v_sender is null then raise exception 'authentication required'; end if;
  if not private.has_role('teacher'::public.app_role) then raise exception 'teacher role required'; end if;
  v_teacher_id := private.teacher_id_for_user();
  if v_teacher_id is null then raise exception 'teacher profile required'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 5000 then raise exception 'invalid body'; end if;
  if v_request_key is null or char_length(v_request_key) < 8 or char_length(v_request_key) > 160 then raise exception 'invalid request key'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('curio-teacher-chat-request:' || v_sender::text || ':' || v_request_key, 0));

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
      and mt.thread_type in ('family', 'student')
      and mt.context_student_id is not null
      and private.teacher_has_student(mt.context_student_id)
    limit 1;

    if v_thread_id is null then raise exception 'thread unavailable'; end if;
  else
    if p_target_kind not in ('family', 'student') then raise exception 'invalid target kind'; end if;
    if p_student_id is null or not private.teacher_has_student(p_student_id) then raise exception 'student unavailable'; end if;

    select coalesce(s.preferred_name, s.full_name, 'Aluno') into v_student_name
    from public.students s
    where s.id = p_student_id and s.deleted_at is null and s.status <> 'inactive';
    if v_student_name is null then raise exception 'student unavailable'; end if;

    if p_target_kind = 'student' then
      select s.auth_user_id into v_target_user_id
      from public.students s
      where s.id = p_student_id and s.deleted_at is null and s.status <> 'inactive';
      if v_target_user_id is null then raise exception 'student has no portal access'; end if;
    else
      select g.profile_id into v_target_user_id
      from public.guardians g
      join public.guardian_students gs on gs.guardian_id = g.id and gs.student_id = p_student_id
      where g.id = p_guardian_id and g.active = true
      limit 1;
      if v_target_user_id is null then raise exception 'guardian unavailable'; end if;
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'curio-teacher-chat-thread:' || v_sender::text || ':' || v_target_user_id::text || ':' || p_student_id::text || ':' || p_target_kind,
        0
      )
    );

    select mt.id into v_thread_id
    from public.message_threads mt
    where mt.thread_type = p_target_kind
      and mt.context_student_id = p_student_id
      and exists (select 1 from public.message_thread_participants mp where mp.thread_id = mt.id and mp.user_id = v_sender)
      and exists (select 1 from public.message_thread_participants mp where mp.thread_id = mt.id and mp.user_id = v_target_user_id)
      and 2 = (select count(*) from public.message_thread_participants mp where mp.thread_id = mt.id)
    order by mt.created_at
    limit 1;

    if v_thread_id is null then
      insert into public.message_threads(subject, thread_type, context_student_id)
      values (
        case when p_target_kind = 'family' then 'Conversa sobre ' || v_student_name else 'Conversa com ' || v_student_name end,
        p_target_kind,
        p_student_id
      )
      returning id into v_thread_id;

      insert into public.message_thread_participants(thread_id, user_id)
      values (v_thread_id, v_sender), (v_thread_id, v_target_user_id)
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

revoke all on function public.send_teacher_chat_message(uuid,text,uuid,uuid,text,text) from public, anon;
grant execute on function public.send_teacher_chat_message(uuid,text,uuid,uuid,text,text) to authenticated;

-- Em conversas com aluno, o professor só mantém acesso enquanto o vínculo pedagógico existir.
create or replace function private.can_access_message_thread(target_thread uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then false
    when private.has_role('admin'::public.app_role) then true
    else exists (
      select 1
      from public.message_thread_participants mp
      join public.message_threads mt on mt.id = mp.thread_id
      where mp.thread_id = target_thread
        and mp.user_id = auth.uid()
        and case
          when mt.thread_type = 'family' then
            mt.context_student_id is not null
            and (
              private.teacher_has_student(mt.context_student_id)
              or private.guardian_has_student(mt.context_student_id)
            )
          when mt.thread_type = 'student' then
            mt.context_student_id is not null
            and (
              private.teacher_has_student(mt.context_student_id)
              or exists (
                select 1
                from public.students s
                where s.id = mt.context_student_id
                  and s.deleted_at is null
                  and s.auth_user_id = auth.uid()
              )
            )
          else true
        end
    )
  end;
$$;

revoke all on function private.can_access_message_thread(uuid) from public, anon;
grant execute on function private.can_access_message_thread(uuid) to authenticated;
