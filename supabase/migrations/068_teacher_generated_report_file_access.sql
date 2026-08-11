-- CURIÓ · Professor/Admin podem anexar arquivos privados aos relatórios que produzem.
-- A leitura continua controlada pela policy generated_documents_visible, que exige
-- vínculo real com o aluno/contrato ou propriedade da pasta.

drop policy if exists generated_documents_team_insert on storage.objects;
create policy generated_documents_team_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'generated-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (
    private.has_role('teacher'::public.app_role)
    or private.has_role('admin'::public.app_role)
  )
);

drop policy if exists generated_documents_team_update on storage.objects;
create policy generated_documents_team_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'generated-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (
    private.has_role('teacher'::public.app_role)
    or private.has_role('admin'::public.app_role)
  )
)
with check (
  bucket_id = 'generated-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (
    private.has_role('teacher'::public.app_role)
    or private.has_role('admin'::public.app_role)
  )
);

drop policy if exists generated_documents_team_delete on storage.objects;
create policy generated_documents_team_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'generated-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (
    private.has_role('teacher'::public.app_role)
    or private.has_role('admin'::public.app_role)
  )
);
