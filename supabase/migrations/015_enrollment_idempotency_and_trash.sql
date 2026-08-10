-- CURIÓ · Estabilização da matrícula e Lixeira operacional
-- Mudanças aditivas e não destrutivas. Não remove duplicados existentes automaticamente.

alter table public.access_invitations
  add column if not exists idempotency_key text,
  add column if not exists request_day date not null default current_date,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists delete_reason text;

create unique index if not exists access_invitations_idempotency_day_uidx
  on public.access_invitations(idempotency_key, request_day)
  where idempotency_key is not null and deleted_at is null;

create index if not exists access_invitations_operational_idx
  on public.access_invitations(role, created_at desc)
  where deleted_at is null;

alter table public.enrollment_requests
  add column if not exists idempotency_key text,
  add column if not exists request_day date not null default current_date,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists delete_reason text;

create unique index if not exists enrollment_requests_idempotency_day_uidx
  on public.enrollment_requests(idempotency_key, request_day)
  where idempotency_key is not null and deleted_at is null;

create index if not exists enrollment_requests_operational_idx
  on public.enrollment_requests(created_at desc)
  where deleted_at is null;

alter table public.students
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists delete_reason text;

create index if not exists students_operational_idx
  on public.students(status, preferred_name)
  where deleted_at is null;

-- Evita clicar repetidamente em "Excluir" e gerar múltiplas entradas ativas
-- da Lixeira para a mesma entidade.
create unique index if not exists trash_items_active_entity_uidx
  on public.trash_items(entity_type, entity_id)
  where restored_at is null and entity_id is not null;
