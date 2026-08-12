-- CURIÓ · vínculo idempotente entre rascunho de preparação e conteúdo final

create table if not exists public.content_preparation_outputs (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.content_preparation_drafts(id) on delete cascade,
  output_type text not null check (output_type in ('mission','quiz','activity','material','assessment','notebook_pdf')),
  output_id uuid not null,
  created_at timestamptz not null default now(),
  unique(draft_id, output_type)
);

create index if not exists content_preparation_outputs_draft_idx on public.content_preparation_outputs(draft_id, created_at desc);
alter table public.content_preparation_outputs enable row level security;

drop policy if exists content_preparation_outputs_owner on public.content_preparation_outputs;
create policy content_preparation_outputs_owner on public.content_preparation_outputs for all to authenticated
using (
  private.has_role('admin'::app_role)
  or exists(select 1 from public.content_preparation_drafts d where d.id=draft_id and d.created_by_teacher_id=private.teacher_id_for_user())
)
with check (
  private.has_role('admin'::app_role)
  or exists(select 1 from public.content_preparation_drafts d where d.id=draft_id and d.created_by_teacher_id=private.teacher_id_for_user())
);
