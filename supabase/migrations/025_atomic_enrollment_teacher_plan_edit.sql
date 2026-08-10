-- CURIÓ · Troca atômica de professor/plano na matrícula existente
-- Reaproveita finalize_guardian_enrollment e encerra o vínculo anterior sem recriar aluno.

create or replace function public.finalize_guardian_enrollment(
  p_invitation_id uuid,
  p_teacher_id uuid,
  p_plan_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  v_inv public.access_invitations%rowtype;
  v_guardian_id uuid;
  v_price numeric;
  v_subscription_id uuid;
begin
  if not private.has_role('admin'::app_role) then
    raise exception 'admin required';
  end if;

  select * into v_inv
  from public.access_invitations
  where id = p_invitation_id
    and role = 'guardian'::app_role
    and deleted_at is null
  for update;

  if not found or v_inv.student_id is null or v_inv.auth_user_id is null then
    raise exception 'invitation is not ready to finalize';
  end if;

  if not exists (select 1 from public.teachers t where t.id = p_teacher_id and t.active = true) then
    raise exception 'teacher unavailable';
  end if;

  select p.monthly_price into v_price
  from public.plans p
  where p.id = p_plan_id
    and p.active = true
    and p.available_for_enrollment = true
    and p.archived_at is null
    and p.deleted_at is null;
  if v_price is null then
    raise exception 'plan unavailable';
  end if;

  select g.id into v_guardian_id
  from public.guardians g
  where g.profile_id = v_inv.auth_user_id;
  if v_guardian_id is null then
    raise exception 'guardian profile missing';
  end if;

  insert into public.guardian_students(guardian_id,student_id,relationship,can_view_progress,can_manage_access)
  values (v_guardian_id,v_inv.student_id,coalesce(v_inv.relationship,'Responsável'),true,true)
  on conflict (guardian_id,student_id) do update set
    relationship = excluded.relationship,
    can_view_progress = true,
    can_manage_access = true;

  if v_inv.teacher_id is not null and v_inv.teacher_id <> p_teacher_id then
    update public.teacher_students
    set active = false
    where teacher_id = v_inv.teacher_id
      and student_id = v_inv.student_id
      and active = true;
  end if;

  insert into public.teacher_students(teacher_id,student_id,active)
  values (p_teacher_id,v_inv.student_id,true)
  on conflict (teacher_id,student_id) do update set active = true;

  select s.id into v_subscription_id
  from public.subscriptions s
  where s.student_id = v_inv.student_id
    and s.status in ('pending','active')
  order by s.created_at
  limit 1
  for update;

  if v_subscription_id is null then
    insert into public.subscriptions(guardian_id,student_id,plan_id,status,agreed_monthly_price,starts_at)
    values (v_guardian_id,v_inv.student_id,p_plan_id,'pending',v_price,current_date)
    returning id into v_subscription_id;
  else
    update public.subscriptions
    set guardian_id = v_guardian_id,
        plan_id = p_plan_id,
        agreed_monthly_price = v_price,
        updated_at = now()
    where id = v_subscription_id;
  end if;

  update public.access_invitations
  set teacher_id = p_teacher_id,
      plan_id = p_plan_id,
      enrollment_finalized_at = coalesce(enrollment_finalized_at,now()),
      updated_at = now(),
      last_error = null
  where id = v_inv.id;

  return v_subscription_id;
end;
$$;

revoke all on function public.finalize_guardian_enrollment(uuid,uuid,uuid) from public;
grant execute on function public.finalize_guardian_enrollment(uuid,uuid,uuid) to authenticated;
