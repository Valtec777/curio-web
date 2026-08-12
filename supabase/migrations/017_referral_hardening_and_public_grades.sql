-- CURIÓ — endurecimento do fluxo de indicação e correção do catálogo público de séries.

-- O formulário público já consultava grades, mas a política original só permitia
-- leitura para authenticated. Série é catálogo não sensível: o público lê apenas ativas.
grant select on public.grades to anon;

drop policy if exists grades_public_active_read on public.grades;
create policy grades_public_active_read
on public.grades for select to anon
using (active = true);

-- Evita depender de COALESCE em records no retorno do trigger de sincronização.
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
    return new;
  end if;

  if tg_op = 'DELETE' and old.role in ('guardian'::public.app_role, 'teacher'::public.app_role) then
    update public.referral_codes
    set active = false, updated_at = now()
    where owner_user_id = old.user_id and owner_role = old.role;
    return old;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.sync_referral_code_for_role() from public, anon, authenticated;

-- A operação administrativa segue uma sequência irreversível:
-- new -> converted -> qualified -> rewarded, com rejeição possível antes do reward.
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
  if old.status <> new.status then
    if old.status = 'new' and new.status not in ('converted', 'rejected') then
      raise exception 'Registre a conversão antes de avançar a indicação.';
    elsif old.status = 'converted' and new.status not in ('qualified', 'rejected') then
      raise exception 'A indicação convertida precisa ser qualificada antes da recompensa.';
    elsif old.status = 'qualified' and new.status not in ('rewarded', 'rejected') then
      raise exception 'A indicação qualificada só pode ser recompensada ou rejeitada.';
    elsif old.status in ('rewarded', 'rejected') then
      raise exception 'Este status é final e não pode ser alterado.';
    end if;
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

  if new.status = 'converted' and old.status = 'new' then
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
    new.qualified_at := coalesce(new.qualified_at, old.qualified_at, now());
  end if;

  if new.status = 'rewarded' and old.status = 'qualified' then
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
