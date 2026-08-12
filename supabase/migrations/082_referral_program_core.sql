-- CURIÓ · Central de Indicações
-- Origem separada de convites de login; benefício somente após primeiro pagamento confirmado.

create table if not exists public.referral_program_settings (
  id uuid primary key default gen_random_uuid(), active boolean not null default false,
  benefit_type text not null default 'none' check (benefit_type in ('none','percent_discount','fixed_discount','extra_resource')),
  benefit_percent numeric(5,2) null check (benefit_percent is null or (benefit_percent > 0 and benefit_percent <= 100)),
  benefit_amount numeric(12,2) null check (benefit_amount is null or benefit_amount > 0), extra_resource_key text null,
  required_confirmed_referrals integer not null default 1 check (required_confirmed_referrals between 1 and 100),
  starts_at date null, ends_at date null, public_rules text null,
  updated_by_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);
create unique index if not exists referral_program_singleton on public.referral_program_settings ((true));
insert into public.referral_program_settings(active,benefit_type,required_confirmed_referrals,public_rules)
select false,'none',1,'O benefício é liberado somente após a confirmação da primeira mensalidade da família indicada.'
where not exists (select 1 from public.referral_program_settings);

create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(), code text not null unique,
  owner_type text not null check (owner_type in ('guardian','teacher')),
  guardian_id uuid null references public.guardians(id) on delete cascade,
  teacher_id uuid null references public.teachers(id) on delete cascade,
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((owner_type='guardian' and guardian_id is not null and teacher_id is null) or (owner_type='teacher' and teacher_id is not null and guardian_id is null))
);
create unique index if not exists referral_codes_guardian_unique on public.referral_codes(guardian_id) where guardian_id is not null;
create unique index if not exists referral_codes_teacher_unique on public.referral_codes(teacher_id) where teacher_id is not null;

alter table public.enrollment_requests add column if not exists referral_code text null;

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(), referral_code_id uuid not null references public.referral_codes(id) on delete restrict,
  enrollment_request_id uuid not null unique references public.enrollment_requests(id) on delete restrict,
  referred_guardian_id uuid null references public.guardians(id) on delete set null,
  referred_student_id uuid null references public.students(id) on delete set null,
  subscription_id uuid null unique references public.subscriptions(id) on delete set null,
  first_payment_id uuid null unique references public.payments(id) on delete set null,
  status text not null default 'lead' check (status in ('lead','enrolled','payment_confirmed','cancelled')),
  enrolled_at timestamptz null, confirmed_at timestamptz null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists referrals_code_status_idx on public.referrals(referral_code_id,status,created_at desc);

create table if not exists public.referral_benefits (
  id uuid primary key default gen_random_uuid(), referral_id uuid not null unique references public.referrals(id) on delete restrict,
  beneficiary_guardian_id uuid not null references public.guardians(id) on delete restrict,
  benefit_type text not null check (benefit_type in ('percent_discount','fixed_discount','extra_resource')),
  benefit_percent numeric(5,2) null, benefit_amount numeric(12,2) null, extra_resource_key text null,
  status text not null default 'available' check (status in ('available','applied','cancelled')),
  available_at timestamptz not null default now(), applied_at timestamptz null,
  applied_by_user_id uuid null references auth.users(id) on delete set null, admin_note text null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

alter table public.referral_program_settings enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.referral_benefits enable row level security;

create policy referral_settings_admin_all on public.referral_program_settings for all to authenticated using (private.has_role('admin'::public.app_role)) with check (private.has_role('admin'::public.app_role));
create policy referral_codes_admin_all on public.referral_codes for all to authenticated using (private.has_role('admin'::public.app_role)) with check (private.has_role('admin'::public.app_role));
create policy referral_codes_owner_read on public.referral_codes for select to authenticated using ((owner_type='guardian' and guardian_id=private.guardian_id_for_user()) or (owner_type='teacher' and teacher_id=private.teacher_id_for_user()));
create policy referrals_admin_all on public.referrals for all to authenticated using (private.has_role('admin'::public.app_role)) with check (private.has_role('admin'::public.app_role));
create policy referrals_owner_read on public.referrals for select to authenticated using (exists (select 1 from public.referral_codes rc where rc.id=referrals.referral_code_id and ((rc.owner_type='guardian' and rc.guardian_id=private.guardian_id_for_user()) or (rc.owner_type='teacher' and rc.teacher_id=private.teacher_id_for_user()))));
create policy referral_benefits_admin_all on public.referral_benefits for all to authenticated using (private.has_role('admin'::public.app_role)) with check (private.has_role('admin'::public.app_role));
create policy referral_benefits_guardian_read on public.referral_benefits for select to authenticated using (beneficiary_guardian_id=private.guardian_id_for_user());

revoke all on public.referral_program_settings,public.referral_codes,public.referrals,public.referral_benefits from anon;
grant select on public.referral_codes,public.referrals,public.referral_benefits to authenticated;
grant select,insert,update,delete on public.referral_program_settings,public.referral_codes,public.referrals,public.referral_benefits to authenticated;

create or replace function private.referral_program_is_active(s public.referral_program_settings) returns boolean language sql stable as $$
  select s.active and (s.starts_at is null or current_date >= s.starts_at) and (s.ends_at is null or current_date <= s.ends_at)
$$;

create or replace function public.ensure_my_referral_code(p_owner_type text)
returns table(code text, owner_type text) language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_guardian uuid; v_teacher uuid; v_code text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_owner_type='guardian' then
    v_guardian:=private.guardian_id_for_user(); if v_guardian is null then raise exception 'guardian profile required'; end if;
    select rc.code into v_code from public.referral_codes rc where rc.guardian_id=v_guardian limit 1;
    if v_code is null then loop v_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)); begin insert into public.referral_codes(code,owner_type,guardian_id) values(v_code,'guardian',v_guardian); exit; exception when unique_violation then select rc.code into v_code from public.referral_codes rc where rc.guardian_id=v_guardian limit 1; if v_code is not null then exit; end if; end; end loop; end if;
  elsif p_owner_type='teacher' then
    v_teacher:=private.teacher_id_for_user(); if v_teacher is null then raise exception 'teacher profile required'; end if;
    select rc.code into v_code from public.referral_codes rc where rc.teacher_id=v_teacher limit 1;
    if v_code is null then loop v_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)); begin insert into public.referral_codes(code,owner_type,teacher_id) values(v_code,'teacher',v_teacher); exit; exception when unique_violation then select rc.code into v_code from public.referral_codes rc where rc.teacher_id=v_teacher limit 1; if v_code is not null then exit; end if; end; end loop; end if;
  else raise exception 'invalid owner type'; end if;
  return query select v_code,p_owner_type;
end $$;
revoke all on function public.ensure_my_referral_code(text) from public,anon;
grant execute on function public.ensure_my_referral_code(text) to authenticated;

create or replace function public.my_referral_summary(p_owner_type text)
returns table(code text,total_referrals integer,confirmed_referrals integer,available_benefits integer,program_active boolean,public_rules text)
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_guardian uuid; v_teacher uuid; v_code_id uuid; v_code text; v_settings public.referral_program_settings%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_owner_type='guardian' then v_guardian:=private.guardian_id_for_user(); if v_guardian is null then raise exception 'guardian profile required'; end if; select id,rc.code into v_code_id,v_code from public.referral_codes rc where rc.guardian_id=v_guardian and rc.active limit 1;
  elsif p_owner_type='teacher' then v_teacher:=private.teacher_id_for_user(); if v_teacher is null then raise exception 'teacher profile required'; end if; select id,rc.code into v_code_id,v_code from public.referral_codes rc where rc.teacher_id=v_teacher and rc.active limit 1;
  else raise exception 'invalid owner type'; end if;
  select * into v_settings from public.referral_program_settings limit 1;
  return query select v_code,(select count(*)::int from public.referrals r where r.referral_code_id=v_code_id and r.status<>'cancelled'),(select count(*)::int from public.referrals r where r.referral_code_id=v_code_id and r.status='payment_confirmed'),case when p_owner_type='guardian' then (select count(*)::int from public.referral_benefits b where b.beneficiary_guardian_id=v_guardian and b.status='available') else 0 end,coalesce(private.referral_program_is_active(v_settings),false),v_settings.public_rules;
end $$;
revoke all on function public.my_referral_summary(text) from public,anon;
grant execute on function public.my_referral_summary(text) to authenticated;

create or replace function public.referral_landing(p_code text)
returns table(owner_type text,owner_name text,program_active boolean,public_rules text)
language plpgsql stable security definer set search_path=public,private,pg_temp as $$
declare v_settings public.referral_program_settings%rowtype;
begin
 select * into v_settings from public.referral_program_settings limit 1;
 return query select rc.owner_type,case when rc.owner_type='guardian' then coalesce(gp.preferred_name,gp.full_name,'Uma família Curió') else coalesce(tp.preferred_name,tp.full_name,'Professor Curió') end,private.referral_program_is_active(v_settings),v_settings.public_rules from public.referral_codes rc left join public.guardians g on g.id=rc.guardian_id left join public.profiles gp on gp.id=g.profile_id left join public.teachers t on t.id=rc.teacher_id left join public.profiles tp on tp.id=t.profile_id where rc.code=upper(trim(p_code)) and rc.active and private.referral_program_is_active(v_settings) limit 1;
end $$;
revoke all on function public.referral_landing(text) from public;
grant execute on function public.referral_landing(text) to anon,authenticated;

create or replace function private.capture_referral_lead() returns trigger language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_code public.referral_codes%rowtype; v_settings public.referral_program_settings%rowtype;
begin
 if new.referral_code is null or trim(new.referral_code)='' then return new; end if; select * into v_settings from public.referral_program_settings limit 1; if not coalesce(private.referral_program_is_active(v_settings),false) then return new; end if; select * into v_code from public.referral_codes where code=upper(trim(new.referral_code)) and active limit 1; if v_code.id is null then return new; end if;
 insert into public.referrals(referral_code_id,enrollment_request_id,status) values(v_code.id,new.id,'lead') on conflict(enrollment_request_id) do nothing;
 if v_code.owner_type='teacher' and new.assigned_to_teacher_id is null then update public.enrollment_requests set assigned_to_teacher_id=v_code.teacher_id,updated_at=now() where id=new.id; end if; return new;
end $$;
drop trigger if exists trg_capture_referral_lead on public.enrollment_requests;
create trigger trg_capture_referral_lead after insert on public.enrollment_requests for each row execute function private.capture_referral_lead();

create or replace function public.admin_link_referral_enrollment(p_enrollment_request_id uuid,p_guardian_id uuid,p_student_id uuid,p_subscription_id uuid) returns boolean language plpgsql security definer set search_path=public,private,pg_temp as $$
begin if not private.has_role('admin'::public.app_role) then raise exception 'admin required'; end if; update public.referrals set referred_guardian_id=p_guardian_id,referred_student_id=p_student_id,subscription_id=p_subscription_id,status='enrolled',enrolled_at=coalesce(enrolled_at,now()),updated_at=now() where enrollment_request_id=p_enrollment_request_id and status in ('lead','enrolled'); return found; end $$;
revoke all on function public.admin_link_referral_enrollment(uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.admin_link_referral_enrollment(uuid,uuid,uuid,uuid) to authenticated;

create or replace function private.confirm_referral_from_payment() returns trigger language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_ref public.referrals%rowtype; v_code public.referral_codes%rowtype; v_settings public.referral_program_settings%rowtype; v_confirmed_count integer;
begin
 if new.status<>'paid' or (old.status='paid' and old.paid_at is not distinct from new.paid_at) then return new; end if;
 select * into v_ref from public.referrals where subscription_id=new.subscription_id and status='enrolled' limit 1 for update; if v_ref.id is null then return new; end if;
 update public.referrals set status='payment_confirmed',first_payment_id=new.id,confirmed_at=coalesce(new.paid_at,now()),updated_at=now() where id=v_ref.id;
 select * into v_code from public.referral_codes where id=v_ref.referral_code_id; select * into v_settings from public.referral_program_settings limit 1;
 if v_code.owner_type<>'guardian' or v_code.guardian_id is null or not coalesce(private.referral_program_is_active(v_settings),false) or v_settings.benefit_type='none' then return new; end if;
 select count(*)::int into v_confirmed_count from public.referrals where referral_code_id=v_code.id and status='payment_confirmed'; if v_confirmed_count % greatest(v_settings.required_confirmed_referrals,1) <> 0 then return new; end if;
 insert into public.referral_benefits(referral_id,beneficiary_guardian_id,benefit_type,benefit_percent,benefit_amount,extra_resource_key,status) values(v_ref.id,v_code.guardian_id,v_settings.benefit_type,v_settings.benefit_percent,v_settings.benefit_amount,v_settings.extra_resource_key,'available') on conflict(referral_id) do nothing; return new;
end $$;
drop trigger if exists trg_confirm_referral_from_payment on public.payments;
create trigger trg_confirm_referral_from_payment after update of status,paid_at on public.payments for each row execute function private.confirm_referral_from_payment();
