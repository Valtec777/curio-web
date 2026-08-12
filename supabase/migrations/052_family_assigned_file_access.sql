-- CURIÓ · acesso privado a arquivos atribuídos.
-- O arquivo continua privado; Família/Aluno só abrem quando existe vínculo/atribuição real.

drop policy if exists teacher_materials_owner_select on storage.objects;
create policy teacher_materials_owner_select on storage.objects
for select to authenticated
using (
  bucket_id = 'teacher-materials'
  and (
    private.has_role('admin'::public.app_role)
    or (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (
      select 1
      from public.materials m
      join public.material_assignments ma on ma.material_id = m.id
      where m.file_path = name
        and (
          private.guardian_has_student(ma.student_id)
          or exists (select 1 from public.students s where s.id = ma.student_id and s.auth_user_id = (select auth.uid()) and s.deleted_at is null)
        )
    )
    or exists (
      select 1
      from public.notebook_activities n
      join public.notebook_assignments na on na.activity_id = n.id
      where n.worksheet_path = name
        and (
          private.guardian_has_student(na.student_id)
          or exists (select 1 from public.students s where s.id = na.student_id and s.auth_user_id = (select auth.uid()) and s.deleted_at is null)
        )
    )
    or exists (
      select 1
      from public.assessments a
      join public.assessment_students ast on ast.assessment_id = a.id
      where a.file_path = name
        and (
          private.guardian_can_view_progress(ast.student_id)
          or exists (select 1 from public.students s where s.id = ast.student_id and s.auth_user_id = (select auth.uid()) and s.deleted_at is null)
        )
    )
  )
);

drop policy if exists generated_documents_visible on storage.objects;
create policy generated_documents_visible on storage.objects
for select to authenticated
using (
  bucket_id = 'generated-documents'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or private.has_role('admin'::public.app_role)
    or exists (
      select 1 from public.generated_reports r
      where r.file_path = name
        and (
          private.teacher_has_student(r.student_id)
          or private.guardian_can_view_progress(r.student_id)
          or exists (select 1 from public.students s where s.id = r.student_id and s.auth_user_id = (select auth.uid()) and s.deleted_at is null)
        )
    )
    or exists (
      select 1
      from public.contracts c
      join public.subscriptions s on s.id = c.subscription_id
      where c.document_path = name
        and s.guardian_id = private.guardian_id_for_user()
    )
  )
);
