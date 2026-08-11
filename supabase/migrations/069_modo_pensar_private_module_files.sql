-- CURIÓ · arquivos do Modo Pensar ficam privados e só são lidos depois do início da trilha.
-- Admin continua usando a pasta própria; aluno/família/professor precisam de vínculo real com uma matrícula na trilha.

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/webp'
]::text[]
where id = 'generated-documents';

drop policy if exists generated_documents_course_files on storage.objects;
create policy generated_documents_course_files
on storage.objects
for select
to authenticated
using (
  bucket_id = 'generated-documents'
  and exists (
    select 1
    from public.free_course_modules m
    join public.free_courses c on c.id = m.course_id
    join public.free_course_enrollments e on e.course_id = c.id
    where m.file_path = storage.objects.name
      and c.status = 'published'
      and (
        private.has_role('admin'::public.app_role)
        or private.teacher_has_student(e.student_id)
        or private.guardian_can_view_progress(e.student_id)
        or exists (
          select 1
          from public.students s
          where s.id = e.student_id
            and s.auth_user_id = (select auth.uid())
            and s.deleted_at is null
        )
      )
  )
);
