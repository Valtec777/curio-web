-- CURIÓ · Restringe metadados de avaliações e Caderno Curió aos vínculos autorizados.
-- Admin e professor autor continuam vendo rascunhos; aluno/família só veem itens publicados e atribuídos.

drop policy if exists assessments_select on public.assessments;
create policy assessments_select
on public.assessments
for select
to authenticated
using (
  private.has_role('admin'::public.app_role)
  or created_by_teacher_id = private.teacher_id_for_user()
  or (
    status = 'published'
    and exists (
      select 1
      from public.assessment_students ast
      where ast.assessment_id = assessments.id
        and (
          private.teacher_has_student(ast.student_id)
          or private.guardian_can_view_progress(ast.student_id)
          or exists (
            select 1
            from public.students s
            where s.id = ast.student_id
              and s.auth_user_id = (select auth.uid())
              and s.deleted_at is null
          )
        )
    )
  )
);

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
    and exists (
      select 1
      from public.notebook_assignments na
      where na.activity_id = notebook_activities.id
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
    )
  )
);
