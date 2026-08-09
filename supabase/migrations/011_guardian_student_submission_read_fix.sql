drop policy if exists submissions_select on public.submissions;
create policy submissions_select
on public.submissions
for select
to authenticated
using (
  private.has_role('admin'::app_role)
  or private.teacher_has_student(student_id)
  or private.guardian_has_student(student_id)
  or student_id in (
    select s.id from public.students s where s.auth_user_id = (select auth.uid())
  )
);
