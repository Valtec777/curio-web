-- CURIÓ v1 — Acesso institucional por convite
create table if not exists public.access_invitations (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  role app_role not null,
  full_name text not null,
  preferred_name text,
  phone_whatsapp text,
  student_id uuid references public.students(id) on delete set null,
  relationship text,
  invited_by_user_id uuid references public.profiles(id) on delete set null,
  auth_user_id uuid,
  status text not null default 'pending' check (status in ('pending','sent','accepted','cancelled','error')),
  sent_at timestamptz,
  accepted_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_access_invitations_email on public.access_invitations(lower(email::text));
create index if not exists idx_access_invitations_status on public.access_invitations(status, created_at desc);
create index if not exists idx_access_invitations_user on public.access_invitations(auth_user_id) where auth_user_id is not null;

alter table public.access_invitations enable row level security;
drop policy if exists access_invitations_admin_all on public.access_invitations;
create policy access_invitations_admin_all on public.access_invitations
for all to authenticated
using (private.has_role('admin'::app_role))
with check (private.has_role('admin'::app_role));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.access_invitations%rowtype;
  v_role app_role := 'guardian'::app_role;
  v_full_name text;
  v_preferred_name text;
  v_phone text;
begin
  select * into v_inv
  from public.access_invitations
  where lower(email::text) = lower(coalesce(new.email,''))
    and status in ('pending','sent')
  order by created_at desc
  limit 1;

  if found then
    v_role := v_inv.role;
    v_full_name := coalesce(nullif(v_inv.full_name,''), new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email,''), '@', 1));
    v_preferred_name := coalesce(nullif(v_inv.preferred_name,''), new.raw_user_meta_data->>'preferred_name', v_full_name);
    v_phone := v_inv.phone_whatsapp;
  else
    v_role := 'guardian'::app_role;
    v_full_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email,''), '@', 1));
    v_preferred_name := coalesce(new.raw_user_meta_data->>'preferred_name', new.raw_user_meta_data->>'full_name', v_full_name);
    v_phone := new.raw_user_meta_data->>'phone_whatsapp';
  end if;

  insert into public.profiles(id, full_name, preferred_name, phone_whatsapp)
  values (new.id, v_full_name, v_preferred_name, v_phone)
  on conflict (id) do update set
    full_name = excluded.full_name,
    preferred_name = coalesce(excluded.preferred_name, public.profiles.preferred_name),
    phone_whatsapp = coalesce(excluded.phone_whatsapp, public.profiles.phone_whatsapp),
    updated_at = now();

  insert into public.user_roles(user_id, role) values (new.id, v_role) on conflict do nothing;

  if v_role = 'guardian'::app_role then
    insert into public.guardians(profile_id) values (new.id) on conflict (profile_id) do nothing;
  elsif v_role = 'teacher'::app_role then
    insert into public.teachers(profile_id, phone_whatsapp, active)
    values (new.id, v_phone, true)
    on conflict (profile_id) do update set phone_whatsapp = coalesce(excluded.phone_whatsapp, public.teachers.phone_whatsapp), active = true;
  end if;

  if v_inv.id is not null then
    update public.access_invitations
      set auth_user_id = new.id, status = 'sent', sent_at = coalesce(sent_at, now()), updated_at = now(), last_error = null
      where id = v_inv.id;
  end if;
  return new;
end;
$$;

create or replace function public.mark_access_invitation_accepted()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  update public.access_invitations
    set status = 'accepted', accepted_at = coalesce(accepted_at, now()), updated_at = now(), last_error = null
    where auth_user_id = auth.uid() and status in ('pending','sent');
end;
$$;
revoke all on function public.mark_access_invitation_accepted() from public;
grant execute on function public.mark_access_invitation_accepted() to authenticated;

drop trigger if exists trg_access_invitations_audit on public.access_invitations;
create trigger trg_access_invitations_audit after insert or update or delete on public.access_invitations
for each row execute function private.audit_row_change();
