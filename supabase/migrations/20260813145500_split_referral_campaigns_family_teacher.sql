alter table public.referral_program_settings
  add column if not exists owner_type text;

update public.referral_program_settings
set owner_type = 'guardian'
where owner_type is null;

alter table public.referral_program_settings
  alter column owner_type set default 'guardian',
  alter column owner_type set not null;

alter table public.referral_program_settings
  drop constraint if exists referral_program_settings_owner_type_check;

alter table public.referral_program_settings
  add constraint referral_program_settings_owner_type_check
  check (owner_type in ('guardian','teacher'));

drop index if exists public.referral_program_singleton;

create unique index if not exists referral_program_settings_owner_type_key
  on public.referral_program_settings(owner_type);

insert into public.referral_program_settings (owner_type, active, benefit_type, required_confirmed_referrals, public_rules)
select 'teacher', false, 'none', 1,
  'O benefício do professor é liberado somente após a confirmação da primeira mensalidade da família indicada.'
where not exists (
  select 1 from public.referral_program_settings where owner_type = 'teacher'
);

alter table public.referral_benefits
  alter column beneficiary_guardian_id drop not null;

alter table public.referral_benefits
  add column if not exists beneficiary_teacher_id uuid references public.teachers(id) on delete restrict;

alter table public.referral_benefits
  drop constraint if exists referral_benefits_one_beneficiary_check;

alter table public.referral_benefits
  add constraint referral_benefits_one_beneficiary_check
  check (num_nonnulls(beneficiary_guardian_id, beneficiary_teacher_id) = 1);

create index if not exists referral_benefits_teacher_status_idx
  on public.referral_benefits(beneficiary_teacher_id, status)
  where beneficiary_teacher_id is not null;

drop policy if exists referral_benefits_teacher_read on public.referral_benefits;
create policy referral_benefits_teacher_read
on public.referral_benefits
for select
to authenticated
using (beneficiary_teacher_id = private.teacher_id_for_user());

create or replace function private.capture_referral_lead()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'private', 'pg_temp'
as $$
declare
  v_code public.referral_codes%rowtype;
  v_settings public.referral_program_settings%rowtype;
begin
  if new.referral_code is null or trim(new.referral_code) = '' then return new; end if;

  select * into v_code
  from public.referral_codes
  where code = upper(trim(new.referral_code)) and active
  limit 1;

  if v_code.id is null then return new; end if;

  select * into v_settings
  from public.referral_program_settings
  where owner_type = v_code.owner_type
  limit 1;

  if not coalesce(private.referral_program_is_active(v_settings), false) then return new; end if;

  insert into public.referrals(referral_code_id, enrollment_request_id, status)
  values(v_code.id, new.id, 'lead')
  on conflict(enrollment_request_id) do nothing;

  if v_code.owner_type = 'teacher' and new.assigned_to_teacher_id is null then
    update public.enrollment_requests
    set assigned_to_teacher_id = v_code.teacher_id, updated_at = now()
    where id = new.id;
  end if;
  return new;
end
$$;

create or replace function private.confirm_referral_from_payment()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'private', 'pg_temp'
as $$
declare
  v_ref public.referrals%rowtype;
  v_code public.referral_codes%rowtype;
  v_settings public.referral_program_settings%rowtype;
  v_confirmed_count integer;
begin
  if new.status <> 'paid' or (old.status = 'paid' and old.paid_at is not distinct from new.paid_at) then return new; end if;

  select * into v_ref
  from public.referrals
  where subscription_id = new.subscription_id and status = 'enrolled'
  limit 1 for update;
  if v_ref.id is null then return new; end if;

  update public.referrals
  set status='payment_confirmed', first_payment_id=new.id,
      confirmed_at=coalesce(new.paid_at,now()), updated_at=now()
  where id=v_ref.id;

  select * into v_code from public.referral_codes where id=v_ref.referral_code_id;
  select * into v_settings from public.referral_program_settings where owner_type=v_code.owner_type limit 1;

  if not coalesce(private.referral_program_is_active(v_settings), false) or v_settings.benefit_type='none' then return new; end if;

  select count(*)::int into v_confirmed_count
  from public.referrals
  where referral_code_id=v_code.id and status='payment_confirmed';
  if v_confirmed_count % greatest(v_settings.required_confirmed_referrals,1) <> 0 then return new; end if;

  if v_code.owner_type='guardian' and v_code.guardian_id is not null then
    insert into public.referral_benefits(referral_id,beneficiary_guardian_id,beneficiary_teacher_id,benefit_type,benefit_percent,benefit_amount,extra_resource_key,status)
    values(v_ref.id,v_code.guardian_id,null,v_settings.benefit_type,v_settings.benefit_percent,v_settings.benefit_amount,v_settings.extra_resource_key,'available')
    on conflict(referral_id) do nothing;
  elsif v_code.owner_type='teacher' and v_code.teacher_id is not null then
    insert into public.referral_benefits(referral_id,beneficiary_guardian_id,beneficiary_teacher_id,benefit_type,benefit_percent,benefit_amount,extra_resource_key,status)
    values(v_ref.id,null,v_code.teacher_id,v_settings.benefit_type,v_settings.benefit_percent,v_settings.benefit_amount,v_settings.extra_resource_key,'available')
    on conflict(referral_id) do nothing;
  end if;
  return new;
end
$$;

create or replace function public.my_referral_summary(p_owner_type text)
returns table(code text,total_referrals integer,confirmed_referrals integer,available_benefits integer,program_active boolean,public_rules text)
language plpgsql
security definer
set search_path = 'public', 'private', 'pg_temp'
as $$
declare
  v_guardian uuid;
  v_teacher uuid;
  v_code_id uuid;
  v_code text;
  v_settings public.referral_program_settings%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_owner_type='guardian' then
    v_guardian := private.guardian_id_for_user();
    if v_guardian is null then raise exception 'guardian profile required'; end if;
    select id,rc.code into v_code_id,v_code from public.referral_codes rc where rc.guardian_id=v_guardian and rc.active limit 1;
  elsif p_owner_type='teacher' then
    v_teacher := private.teacher_id_for_user();
    if v_teacher is null then raise exception 'teacher profile required'; end if;
    select id,rc.code into v_code_id,v_code from public.referral_codes rc where rc.teacher_id=v_teacher and rc.active limit 1;
  else
    raise exception 'invalid owner type';
  end if;
  select * into v_settings from public.referral_program_settings where owner_type=p_owner_type limit 1;
  return query
  select v_code,
    (select count(*)::int from public.referrals r where r.referral_code_id=v_code_id and r.status<>'cancelled'),
    (select count(*)::int from public.referrals r where r.referral_code_id=v_code_id and r.status='payment_confirmed'),
    case when p_owner_type='guardian'
      then (select count(*)::int from public.referral_benefits b where b.beneficiary_guardian_id=v_guardian and b.status='available')
      else (select count(*)::int from public.referral_benefits b where b.beneficiary_teacher_id=v_teacher and b.status='available') end,
    coalesce(private.referral_program_is_active(v_settings),false),
    v_settings.public_rules;
end
$$;

create or replace function public.my_teacher_referral_benefits()
returns table(id uuid,benefit_type text,benefit_percent numeric,benefit_amount numeric,extra_resource_key text,status text,available_at timestamptz,applied_at timestamptz)
language plpgsql
stable
security definer
set search_path = 'public', 'private', 'pg_temp'
as $$
declare v_teacher uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  v_teacher := private.teacher_id_for_user();
  if v_teacher is null then raise exception 'teacher profile required'; end if;
  return query
  select b.id,b.benefit_type,b.benefit_percent,b.benefit_amount,b.extra_resource_key,b.status,b.available_at,b.applied_at
  from public.referral_benefits b
  where b.beneficiary_teacher_id=v_teacher
  order by b.created_at desc
  limit 50;
end
$$;

revoke execute on function public.my_teacher_referral_benefits() from public, anon;
grant execute on function public.my_teacher_referral_benefits() to authenticated, service_role;

create or replace function public.referral_landing(p_code text)
returns table(owner_type text,owner_name text,program_active boolean,public_rules text)
language plpgsql
stable
security definer
set search_path = 'public', 'private', 'pg_temp'
as $$
begin
  return query
  select rc.owner_type,
    case when rc.owner_type='guardian' then 'Uma família Curió'::text else coalesce(tp.preferred_name,tp.full_name,'Professor Curió') end,
    private.referral_program_is_active(s),
    s.public_rules
  from public.referral_codes rc
  join public.referral_program_settings s on s.owner_type=rc.owner_type
  left join public.teachers t on t.id=rc.teacher_id
  left join public.profiles tp on tp.id=t.profile_id
  where rc.code=upper(trim(p_code)) and rc.active and private.referral_program_is_active(s)
  limit 1;
end
$$;
