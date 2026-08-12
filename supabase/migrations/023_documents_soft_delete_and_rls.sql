-- CURIÓ · Exclusão lógica de documentos operacionais
-- Preserva arquivo, aluno, família, assinatura e ID para restauração.

alter table public.documents
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists delete_reason text;

create index if not exists documents_deleted_at_idx on public.documents(deleted_at);

drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents
for select to authenticated
using (
  private.has_role('admin'::app_role)
  or (
    deleted_at is null
    and (
      ((student_id is not null) and private.teacher_has_student(student_id))
      or ((visible_to_guardian = true) and (guardian_id = private.guardian_id_for_user()))
      or ((visible_to_guardian = true) and (student_id is not null) and private.guardian_can_view_progress(student_id))
    )
  )
);
