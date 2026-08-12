-- CURIÓ · histórico seguro de indicações e privacidade da página pública.

create or replace function public.referral_landing(p_code text)
returns table(owner_type text, owner_name text, program_active boolean, public_rules text)
language plpgsql stable security definer set search_path=public,private,pg_temp as $$
declare v_settings public.referral_program_settings%rowtype;
begin
  select * into v_settings from public.referral_program_settings limit 1;
  return query
  select rc.owner_type,
    case when rc.owner_type='guardian' then 'Uma família Curió'::text else coalesce(tp.preferred_name,tp.full_name,'Professor Curió') end,
    private.referral_program_is_active(v_settings),
    v_settings.public_rules
  from public.referral_codes rc
  left join public.teachers t on t.id=rc.teacher_id
  left join public.profiles tp on tp.id=t.profile_id
  where rc.code=upper(trim(p_code)) and rc.active
    and private.referral_program_is_active(v_settings)
  limit 1;
end $$;
revoke all on function public.referral_landing(text) from public;
grant execute on function public.referral_landing(text) to anon,authenticated;

create or replace function public.my_referral_activity(p_owner_type text)
returns table(referral_id uuid,guardian_name text,child_name text,status text,created_at timestamptz,enrolled_at timestamptz,confirmed_at timestamptz)
language plpgsql stable security definer set search_path=public,private,pg_temp as $$
declare v_guardian uuid; v_teacher uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_owner_type='guardian' then
    v_guardian:=private.guardian_id_for_user(); if v_guardian is null then raise exception 'guardian profile required'; end if;
  elsif p_owner_type='teacher' then
    v_teacher:=private.teacher_id_for_user(); if v_teacher is null then raise exception 'teacher profile required'; end if;
  else raise exception 'invalid owner type'; end if;
  return query
  select r.id,case when p_owner_type='teacher' then er.guardian_name else null end,er.child_name,r.status,r.created_at,r.enrolled_at,r.confirmed_at
  from public.referrals r join public.referral_codes rc on rc.id=r.referral_code_id join public.enrollment_requests er on er.id=r.enrollment_request_id
  where (p_owner_type='guardian' and rc.guardian_id=v_guardian) or (p_owner_type='teacher' and rc.teacher_id=v_teacher)
  order by r.created_at desc limit 100;
end $$;
revoke all on function public.my_referral_activity(text) from public,anon;
grant execute on function public.my_referral_activity(text) to authenticated;

create or replace function public.my_referral_benefits()
returns table(id uuid,benefit_type text,benefit_percent numeric,benefit_amount numeric,extra_resource_key text,status text,available_at timestamptz,applied_at timestamptz)
language plpgsql stable security definer set search_path=public,private,pg_temp as $$
declare v_guardian uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  v_guardian:=private.guardian_id_for_user(); if v_guardian is null then raise exception 'guardian profile required'; end if;
  return query select b.id,b.benefit_type,b.benefit_percent,b.benefit_amount,b.extra_resource_key,b.status,b.available_at,b.applied_at
  from public.referral_benefits b where b.beneficiary_guardian_id=v_guardian order by b.created_at desc limit 50;
end $$;
revoke all on function public.my_referral_benefits() from public,anon;
grant execute on function public.my_referral_benefits() to authenticated;
