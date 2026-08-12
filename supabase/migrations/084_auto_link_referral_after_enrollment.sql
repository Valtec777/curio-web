-- CURIÓ · quando o interesse vira matrícula, liga a indicação ao aluno/família/assinatura reais.

create or replace function private.auto_link_referral_after_enrollment()
returns trigger language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_student_id uuid; v_guardian_id uuid; v_subscription_id uuid;
begin
  if new.status <> 'enrolled' or old.status is not distinct from new.status then return new; end if;
  if not exists (select 1 from public.referrals r where r.enrollment_request_id=new.id and r.status='lead') then return new; end if;

  select ai.student_id,g.id,s.id into v_student_id,v_guardian_id,v_subscription_id
  from public.access_invitations ai
  join public.guardians g on g.profile_id=ai.auth_user_id and g.active
  join public.subscriptions s on s.student_id=ai.student_id and s.guardian_id=g.id and s.status in ('pending','active','paused')
  where ai.role='guardian' and ai.deleted_at is null and ai.enrollment_finalized_at is not null
    and lower(ai.email::text)=lower(new.email::text)
  order by ai.enrollment_finalized_at desc,s.created_at desc limit 1;

  if v_student_id is null or v_guardian_id is null or v_subscription_id is null then return new; end if;
  update public.referrals set referred_guardian_id=v_guardian_id,referred_student_id=v_student_id,subscription_id=v_subscription_id,status='enrolled',enrolled_at=coalesce(enrolled_at,now()),updated_at=now()
  where enrollment_request_id=new.id and status='lead';
  return new;
end $$;

drop trigger if exists trg_auto_link_referral_after_enrollment on public.enrollment_requests;
create trigger trg_auto_link_referral_after_enrollment after update of status on public.enrollment_requests for each row execute function private.auto_link_referral_after_enrollment();
