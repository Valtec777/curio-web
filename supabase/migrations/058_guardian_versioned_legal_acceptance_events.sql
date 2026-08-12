-- CURIÓ · evidência versionada de decisões jurídicas da Família.
-- O contrato continua usando contracts.signed_by_user_id/signed_at.
-- Esta tabela registra Termos/Privacidade/consentimentos sem sobrescrever o histórico.

create table if not exists public.legal_acceptance_events (
  id uuid primary key default gen_random_uuid(),
  legal_document_id uuid not null references public.legal_documents(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  guardian_id uuid not null references public.guardians(id) on delete restrict,
  student_id uuid references public.students(id) on delete restrict,
  decision text not null check (decision in ('accepted','declined','revoked')),
  document_slug text not null,
  document_version integer not null check (document_version > 0),
  document_title text not null,
  document_type text not null,
  document_published_at timestamptz,
  source text not null default 'family_portal',
  occurred_at timestamptz not null default now()
);

create index if not exists legal_acceptance_events_guardian_idx
  on public.legal_acceptance_events(guardian_id, occurred_at desc);
create index if not exists legal_acceptance_events_student_idx
  on public.legal_acceptance_events(student_id, occurred_at desc)
  where student_id is not null;
create index if not exists legal_acceptance_events_document_idx
  on public.legal_acceptance_events(legal_document_id, occurred_at desc);
create index if not exists legal_acceptance_events_user_idx
  on public.legal_acceptance_events(user_id, occurred_at desc);

alter table public.legal_acceptance_events enable row level security;

revoke all on table public.legal_acceptance_events from anon;
revoke update, delete on table public.legal_acceptance_events from authenticated;
grant select, insert on table public.legal_acceptance_events to authenticated;

drop policy if exists legal_acceptance_events_select on public.legal_acceptance_events;
create policy legal_acceptance_events_select
on public.legal_acceptance_events
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.has_role('admin'::public.app_role))
);

drop policy if exists legal_acceptance_events_insert on public.legal_acceptance_events;
create policy legal_acceptance_events_insert
on public.legal_acceptance_events
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and guardian_id = (select private.guardian_id_for_user())
  and (
    student_id is null
    or (select private.guardian_has_student(student_id))
  )
);

create or replace function private.prepare_legal_acceptance_event()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_user uuid := auth.uid();
  v_guardian uuid;
  v_doc public.legal_documents%rowtype;
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  if not private.has_role('guardian'::public.app_role) then
    raise exception 'guardian role required';
  end if;

  select g.id into v_guardian
  from public.guardians g
  where g.profile_id = v_user
    and g.active = true
  limit 1;

  if v_guardian is null then
    raise exception 'active guardian profile required';
  end if;

  if new.student_id is not null and not exists (
    select 1
    from public.guardian_students gs
    join public.students s on s.id = gs.student_id
    where gs.guardian_id = v_guardian
      and gs.student_id = new.student_id
      and s.deleted_at is null
  ) then
    raise exception 'student is not linked to guardian';
  end if;

  select d.* into v_doc
  from public.legal_documents d
  where d.id = new.legal_document_id
    and d.status = 'published'
    and d.is_current = true
    and (d.body is not null or d.file_path is not null)
  limit 1;

  if v_doc.id is null then
    raise exception 'legal document is not currently published';
  end if;

  new.user_id := v_user;
  new.guardian_id := v_guardian;
  new.document_slug := v_doc.public_slug;
  new.document_version := v_doc.version;
  new.document_title := v_doc.title;
  new.document_type := v_doc.document_type;
  new.document_published_at := v_doc.published_at;
  new.source := 'family_portal';
  new.occurred_at := now();

  return new;
end;
$$;

revoke all on function private.prepare_legal_acceptance_event() from public, anon, authenticated;

drop trigger if exists legal_acceptance_events_prepare on public.legal_acceptance_events;
create trigger legal_acceptance_events_prepare
before insert on public.legal_acceptance_events
for each row execute function private.prepare_legal_acceptance_event();

comment on table public.legal_acceptance_events is
'Append-only evidence of guardian decisions on exact published legal document versions. Contract signatures remain in contracts and are not duplicated here.';
