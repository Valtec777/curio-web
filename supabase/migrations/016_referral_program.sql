-- CURIÓ — programa de indicação sustentável
-- Família e professor recebem links próprios. A recompensa só pode ser marcada
-- após conversão + janela de retenção, com teto por período e controle administrativo.

create table if not exists public.referral_program_rules (
  owner_role public.app_role primary key,
  reward_value numeric(10,2) not null check (reward_value >= 0),
  qualification_days integer not null default 30 check (qualification_days between 1 and 365),
  max_rewards_period integer not null check (max_rewards_period between 1 and 100),
  period_days integer not null check (period_days between 1 and 366),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  check (owner_role in ('guardian'::public.app_role, 'teacher'::public.app_role))
);

insert into public.referral_program_rules (owner_role, reward_value, qualification_days, max_rewards_period, period_days, active)
values
  ('guardian'::public.app_role, 30.00, 30, 3, 365, true),
  ('teacher'::public.app_role, 40.00, 30, 5, 30, true)
on conflict (owner_role) do nothing;

create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  owner_role public.app_role not null,
  code text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, owner_role),
  check (owner_role in ('guardian'::public.app_role, 'teacher'::public.app_role)),
  check (char_length(code) between 12 and 40)
);

create index if not exists referral_codes_owner_idx
  on public.referral_codes(owner_user_id, owner_role, active);

create table if not exists public.referral_leads (
  id uuid primary key default gen_random_uuid(),
  referral_code_id uuid not null references public.referral_codes(id) on delete restrict,
  enrollment_request_id uuid,
  referred_email citext not null,
  status text not null default 'new' check (status in ('new','converted','qualified','rewarded','rejected')),
  reward_value numeric(10,2) not null default 0 check (reward_value >= 0),
  created_at timestamptz not null default now(),
  converted_at timestamptz,
  qualified_at timestamptz,
  rewarded_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists referral_leads_code_created_idx
  on public.referral_leads(referral_code_id, created_at desc);
create index if not exists referral_leads_status_idx
  on public.referral_leads(status, created_at desc);
create unique index if not exists referral_leads_unique_active_email_idx
  on public.referral_leads(lower(referred_email::text))
  where status <> 'rejected';

alter table public.referral_program_rules enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referral_leads enable row level security;

-- Desde 2026, projetos Supabase podem exigir GRANT explícito para novas tabelas
-- aparecerem na Data API. Os GRANTs abaixo são mínimos para cada fluxo.
revoke all on public.referral_program_rules from anon, authenticated;
revoke all on public.referral_codes from anon, authenticated;
revoke all on public.referral_leads from anon, authenticated;

grant select, update on public.referral_program_rules to authenticated;
grant select on public.referral_codes to authenticated;
grant select (id, code, owner_role, active) on public.referral_codes to anon;
grant insert on public.referral_leads to anon, authenticated;
grant select, update on public.referral_leads to authenticated;

-- Regras: visíveis para usuários autenticados; só admin altera.
drop policy if exists referral_rules_read on public.referral_program_rules;
create policy referral_rules_read
on public.referral_program_rules for select to authenticated
using (true);

drop policy if exists referral_rules_admin_update on public.referral_program_rules;
create policy referral_rules_admin_update
on public.referral_program_rules for update to authenticated
using ((select private.has_role('admin'::public.app_role)))
with check ((select private.has_role('admin'::public.app_role)));

-- Código: cada titular vê o próprio; admin vê todos; público só valida códigos ativos.
drop policy if exists referral_codes_owner_read on public.referral_codes;
create policy referral_codes_owner_read
on public.referral_codes for select to authenticated
using (
  owner_user_id = (select auth.uid())
  or (select private.has_role('admin'::public.app_role))
);

drop policy if exists referral_codes_public_active_read on public.referral_codes;
create policy referral_codes_public_active_read
on public.referral_codes for select to anon
using (active = true);

-- Leads: o público só registra; somente admin lê ou altera dados pessoais/status.
drop policy if exists referral_leads_public_insert on public.referral_leads;
create policy referral_leads_public_insert
on public.referral_leads for insert to anon, authenticated
with check (
  status = 'new'
  and reward_value = 0
  and exists (
    select 1
    from public.referral_codes rc
    where rc.id = referral_code_id
      and rc.active = true
  )
);

drop policy if exists referral_leads_admin_read on public.referral_leads;
create policy referral_leads_admin_read
on public.referral_leads for select to authenticated
using ((select private.has_role('admin'::public.app_role)));

drop policy if exists referral_leads_admin_update on public.referral_leads;
create policy referral_leads_admin_update
on public.referral_leads for update to authenticated
using ((select private.has_role('admin'::public.app_role)))
with check ((select private.has_role('admin'::public.app_role)));

-- Gera/desativa código junto com o papel do usuário.
create or replace function private.sync_referral_code_for_role()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  prefix text;
begin
  if tg_op = 'INSERT' and new.role in ('guardian'::public.app_role, 'teacher'::public.app_role) then
    prefix := case when new.role = 'guardian'::public.app_role then 'FAM' else 'PROF' end;
    insert into public.referral_codes (owner_user_id, owner_role, code, active)
    values (
      new.user_id,
      new.role,
      prefix || '-' || upper(encode(gen_random_bytes(8), 'hex')),
      true
    )
    on conflict (owner_user_id, owner_role)
    do update set active = true, updated_at = now();
  elsif tg_op = 'DELETE' and old.role in ('guardian'::public.app_role, 'teacher'::public.app_role) then
    update public.referral_codes
    set active = false, updated_at = now()
    where owner_user_id = old.user_id and owner_role = old.role;
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function private.sync_referral_code_for_role() from public, anon, authenticated;

drop trigger if exists sync_referral_code_for_role on public.user_roles;
create trigger sync_referral_code_for_role
after insert or delete on public.user_roles
for each row execute function private.sync_referral_code_for_role();

-- Backfill para famílias/professores já existentes.
insert into public.referral_codes (owner_user_id, owner_role, code, active)
select
  ur.user_id,
  ur.role,
  (case when ur.role = 'guardian'::public.app_role then 'FAM' else 'PROF' end)
    || '-' || upper(encode(gen_random_bytes(8), 'hex')),
  true
from public.user_roles ur
where ur.role in ('guardian'::public.app_role, 'teacher'::public.app_role)
on conflict (owner_user_id, owner_role) do update set active = true, updated_at = now();

-- Proteções na entrada: normaliza e-mail, bloqueia autoindicação e força estado inicial.
create or replace function private.guard_referral_lead_insert()
returns trigger
language plpgsql
security definer
set search_path = public, auth, private, pg_temp
as $$
declare
  owner_id uuid;
  owner_email text;
  code_active boolean;
begin
  new.referred_email := lower(trim(new.referred_email::text))::citext;
  new.status := 'new';
  new.reward_value := 0;
  new.converted_at := null;
  new.qualified_at := null;
  new.rewarded_at := null;

  select rc.owner_user_id, rc.active
    into owner_id, code_active
  from public.referral_codes rc
  where rc.id = new.referral_code_id;

  if owner_id is null or code_active is not true then
    raise exception 'Código de indicação inválido ou inativo.';
  end if;

  select lower(trim(u.email)) into owner_email
  from auth.users u
  where u.id = owner_id;

  if owner_email is not null and owner_email = lower(trim(new.referred_email::text)) then
    raise exception 'Autoindicação não é elegível.';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_referral_lead_insert() from public, anon, authenticated;

drop trigger if exists guard_referral_lead_insert on public.referral_leads;
create trigger guard_referral_lead_insert
before insert on public.referral_leads
for each row execute function private.guard_referral_lead_insert();

-- Proteção de margem: recompensa só após retenção mínima e nunca acima do teto.
create or replace function private.guard_referral_reward_update()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  rule_row public.referral_program_rules%rowtype;
  owner_role_value public.app_role;
  already_rewarded integer;
begin
  if old.status = 'rewarded' and new.status <> 'rewarded' then
    raise exception 'Uma indicação já recompensada não pode voltar de status.';
  end if;

  select rc.owner_role into owner_role_value
  from public.referral_codes rc
  where rc.id = new.referral_code_id;

  select * into rule_row
  from public.referral_program_rules r
  where r.owner_role = owner_role_value and r.active = true;

  if rule_row.owner_role is null then
    raise exception 'Programa de indicação inativo para este perfil.';
  end if;

  if new.status = 'converted' and old.status <> 'converted' then
    new.converted_at := coalesce(new.converted_at, now());
  end if;

  if new.status in ('qualified', 'rewarded') then
    new.converted_at := coalesce(new.converted_at, old.converted_at);
    if new.converted_at is null then
      raise exception 'Marque a conversão antes de qualificar a indicação.';
    end if;
    if new.converted_at > now() - make_interval(days => rule_row.qualification_days) then
      raise exception 'A indicação ainda não cumpriu a janela mínima de retenção.';
    end if;
    new.qualified_at := coalesce(new.qualified_at, now());
  end if;

  if new.status = 'rewarded' and old.status <> 'rewarded' then
    select count(*) into already_rewarded
    from public.referral_leads rl
    where rl.referral_code_id = new.referral_code_id
      and rl.status = 'rewarded'
      and rl.rewarded_at >= now() - make_interval(days => rule_row.period_days)
      and rl.id <> new.id;

    if already_rewarded >= rule_row.max_rewards_period then
      raise exception 'Teto de recompensas atingido neste período.';
    end if;

    new.reward_value := rule_row.reward_value;
    new.rewarded_at := coalesce(new.rewarded_at, now());
  elsif new.status <> 'rewarded' then
    new.reward_value := 0;
    new.rewarded_at := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.guard_referral_reward_update() from public, anon, authenticated;

drop trigger if exists guard_referral_reward_update on public.referral_leads;
create trigger guard_referral_reward_update
before update on public.referral_leads
for each row execute function private.guard_referral_reward_update();

-- Mantém updated_at da configuração sem depender de trigger legado.
create or replace function private.touch_referral_rule()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.touch_referral_rule() from public, anon, authenticated;

drop trigger if exists touch_referral_program_rules_updated_at on public.referral_program_rules;
create trigger touch_referral_program_rules_updated_at
before update on public.referral_program_rules
for each row execute function private.touch_referral_rule();
