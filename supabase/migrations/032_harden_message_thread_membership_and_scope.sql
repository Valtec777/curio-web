-- CURIÓ · Endurecimento de segurança das conversas internas.
-- Impede autoentrada em threads alheias e mantém threads familiares condicionadas ao vínculo atual com o aluno.

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
        and (
          mt.thread_type <> 'family'
          or (
            mt.context_student_id is not null
            and (
              private.teacher_has_student(mt.context_student_id)
              or private.guardian_has_student(mt.context_student_id)
            )
          )
        )
    )
  end;
$$;

revoke all on function private.can_access_message_thread(uuid) from public;
revoke all on function private.can_access_message_thread(uuid) from anon;
grant execute on function private.can_access_message_thread(uuid) to authenticated;

drop policy if exists threads_select on public.message_threads;
create policy threads_select
on public.message_threads
for select
to authenticated
using (private.can_access_message_thread(id));

drop policy if exists threads_insert on public.message_threads;
create policy threads_insert
on public.message_threads
for insert
to authenticated
with check (
  (select private.has_role('admin'::public.app_role))
  or (select private.has_role('teacher'::public.app_role))
);

drop policy if exists participants_select on public.message_thread_participants;
create policy participants_select
on public.message_thread_participants
for select
to authenticated
using (private.can_access_message_thread(thread_id));

drop policy if exists participants_insert on public.message_thread_participants;
create policy participants_insert
on public.message_thread_participants
for insert
to authenticated
with check ((select private.has_role('admin'::public.app_role)));

drop policy if exists messages_select on public.messages;
create policy messages_select
on public.messages
for select
to authenticated
using (private.can_access_message_thread(thread_id));

drop policy if exists messages_insert on public.messages;
create policy messages_insert
on public.messages
for insert
to authenticated
with check (
  sender_user_id = (select auth.uid())
  and private.can_access_message_thread(thread_id)
);

drop policy if exists messages_update on public.messages;
create policy messages_update
on public.messages
for update
to authenticated
using (
  (select private.has_role('admin'::public.app_role))
  or (
    sender_user_id = (select auth.uid())
    and (select private.has_role('teacher'::public.app_role))
    and private.can_access_message_thread(thread_id)
  )
)
with check (
  (select private.has_role('admin'::public.app_role))
  or (
    sender_user_id = (select auth.uid())
    and (select private.has_role('teacher'::public.app_role))
    and private.can_access_message_thread(thread_id)
  )
);