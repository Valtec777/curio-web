-- CURIÓ · comprovantes de pagamento com conferência humana

create table if not exists public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete restrict,
  submitted_by_user_id uuid not null references auth.users(id) on delete restrict,
  file_path text not null,
  file_name text not null,
  mime_type text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  review_note text,
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payment_receipts_guardian_created
  on public.payment_receipts(guardian_id, created_at desc);
create index if not exists idx_payment_receipts_status_created
  on public.payment_receipts(status, created_at desc);
create unique index if not exists uq_payment_receipts_one_pending_per_payment
  on public.payment_receipts(payment_id)
  where status = 'pending';

alter table public.payment_receipts enable row level security;

drop policy if exists payment_receipts_select on public.payment_receipts;
create policy payment_receipts_select on public.payment_receipts
for select to authenticated
using (
  private.has_role('admin'::app_role)
  or guardian_id in (
    select g.id from public.guardians g
    where g.profile_id = (select auth.uid()) and g.active = true
  )
);

drop policy if exists payment_receipts_insert on public.payment_receipts;
create policy payment_receipts_insert on public.payment_receipts
for insert to authenticated
with check (
  submitted_by_user_id = (select auth.uid())
  and guardian_id in (
    select g.id from public.guardians g
    where g.profile_id = (select auth.uid()) and g.active = true
  )
  and exists (
    select 1
    from public.payments p
    join public.subscriptions s on s.id = p.subscription_id
    where p.id = payment_id
      and s.guardian_id = guardian_id
      and s.status in ('pending','active','paused')
  )
);

drop policy if exists payment_receipts_update_admin on public.payment_receipts;
create policy payment_receipts_update_admin on public.payment_receipts
for update to authenticated
using (private.has_role('admin'::app_role))
with check (private.has_role('admin'::app_role));

drop policy if exists payment_receipts_delete_admin on public.payment_receipts;
create policy payment_receipts_delete_admin on public.payment_receipts
for delete to authenticated
using (private.has_role('admin'::app_role));

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'payment-receipts',
  'payment-receipts',
  false,
  10485760,
  array['application/pdf','image/png','image/jpeg','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists payment_receipts_storage_select on storage.objects;
create policy payment_receipts_storage_select on storage.objects
for select to authenticated
using (
  bucket_id = 'payment-receipts'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or private.has_role('admin'::app_role)
  )
);

drop policy if exists payment_receipts_storage_insert on storage.objects;
create policy payment_receipts_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'payment-receipts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists payment_receipts_storage_delete_admin on storage.objects;
create policy payment_receipts_storage_delete_admin on storage.objects
for delete to authenticated
using (
  bucket_id = 'payment-receipts'
  and private.has_role('admin'::app_role)
);
