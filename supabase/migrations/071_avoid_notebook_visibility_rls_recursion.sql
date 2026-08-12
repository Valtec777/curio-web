-- Compatibilidade com ambientes que já receberam a primeira versão da migration 070.
-- Mantém a checagem de visibilidade do Caderno fora do RLS de notebook_assignments.

create or replace function private.can_read_notebook_activity(p_activity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.notebook_assignments na
    where na.activity_id = p_activity_id
      and (
        private.teacher_has_student(na.student_id)
        or private.guardian_has_student(na.student_id)
        or exists (
          select 1
          from public.students s
          where s.id = na.student_id
            and s.auth_user_id = (select auth.uid())
            and s.deleted_at is null
        )
      )
  );
$$;

revoke all on function private.can_read_notebook_activity(uuid) from public;
revoke all on function private.can_read_notebook_activity(uuid) from anon;
grant execute on function private.can_read_notebook_activity(uuid) to authenticated;

drop policy if exists notebook_activities_read on public.notebook_activities;
create policy notebook_activities_read
on public.notebook_activities
for select
to authenticated
using (
  private.has_role('admin'::public.app_role)
  or created_by_teacher_id = private.teacher_id_for_user()
  or (
    status = 'published'
    and (publish_at is null or publish_at <= now())
    and private.can_read_notebook_activity(id)
  )
);
