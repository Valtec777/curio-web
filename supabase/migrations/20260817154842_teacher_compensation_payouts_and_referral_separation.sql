-- PLUMARELI · remuneração de professores e separação segura das indicações

alter table public.plans
  add column if not exists teacher_compensation_model text not null default 'none',
  add column if not exists teacher_compensation_fixed_amount numeric(12,2),
  add column if not exists teacher_compensation_percent numeric(7,4),
  add column if not exists teacher_compensation_per_meeting numeric(12,2),
  add column if not exists teacher_compensation_meeting_limit integer;

alter table public.plans drop constraint if exists plans_teacher_compensation_model_check;
alter table public.plans add constraint plans_teacher_compensation_model_check
  check (teacher_compensation_model in ('none','fixed_monthly','percent_plan','per_meeting'));

alter table public.plans drop constraint if exists plans_teacher_compensation_values_check;
alter table public.plans add constraint plans_teacher_compensation_values_check check (
  (teacher_compensation_model = 'none' and teacher_compensation_fixed_amount is null and teacher_compensation_percent is null and teacher_compensation_per_meeting is null)
  or (teacher_compensation_model = 'fixed_monthly' and teacher_compensation_fixed_amount > 0 and teacher_compensation_fixed_amount <= monthly_price and teacher_compensation_percent is null and teacher_compensation_per_meeting is null)
  or (teacher_compensation_model = 'percent_plan' and teacher_compensation_percent > 0 and teacher_compensation_percent <= 100 and teacher_compensation_fixed_amount is null and teacher_compensation_per_meeting is null)
  or (teacher_compensation_model = 'per_meeting' and teacher_compensation_per_meeting > 0 and teacher_compensation_fixed_amount is null and teacher_compensation_percent is null and coalesce(teacher_compensation_meeting_limit, meetings_per_month) > 0 and teacher_compensation_per_meeting * coalesce(teacher_compensation_meeting_limit, meetings_per_month) <= monthly_price)
);

alter table public.plans drop constraint if exists plans_teacher_compensation_meeting_limit_check;
alter table public.plans add constraint plans_teacher_compensation_meeting_limit_check
  check (teacher_compensation_meeting_limit is null or teacher_compensation_meeting_limit >= 0);

create unique index if not exists teacher_students_one_active_teacher_per_student
  on public.teacher_students(student_id) where active = true;

alter table public.subscriptions
  add column if not exists teacher_id uuid references public.teachers(id) on delete restrict,
  add column if not exists teacher_compensation_model text,
  add column if not exists teacher_compensation_base_value numeric(12,4),
  add column if not exists teacher_compensation_meeting_limit integer,
  add column if not exists teacher_compensation_plan_price numeric(12,2),
  add column if not exists teacher_compensation_delivery_mode text,
  add column if not exists teacher_compensation_snapshotted_at timestamptz;

update public.subscriptions s
set teacher_id = ts.teacher_id
from public.teacher_students ts
where ts.student_id = s.student_id and ts.active = true and s.teacher_id is null;

alter table public.subscriptions drop constraint if exists subscriptions_teacher_compensation_model_check;
alter table public.subscriptions add constraint subscriptions_teacher_compensation_model_check
  check (teacher_compensation_model is null or teacher_compensation_model in ('none','fixed_monthly','percent_plan','per_meeting'));
alter table public.subscriptions drop constraint if exists subscriptions_teacher_compensation_base_value_check;
alter table public.subscriptions add constraint subscriptions_teacher_compensation_base_value_check
  check (teacher_compensation_base_value is null or teacher_compensation_base_value >= 0);
alter table public.subscriptions drop constraint if exists subscriptions_teacher_compensation_meeting_limit_check;
alter table public.subscriptions add constraint subscriptions_teacher_compensation_meeting_limit_check
  check (teacher_compensation_meeting_limit is null or teacher_compensation_meeting_limit >= 0);

create or replace function private.snapshot_subscription_teacher_compensation()
returns trigger language plpgsql security invoker set search_path = public, private, pg_temp as $$
declare
  v_plan public.plans%rowtype;
  v_teacher_id uuid;
begin
  if new.student_id is not null and new.teacher_id is null then
    select ts.teacher_id into v_teacher_id
    from public.teacher_students ts
    where ts.student_id = new.student_id and ts.active = true
    limit 1;
    new.teacher_id := v_teacher_id;
  end if;

  if tg_op = 'INSERT' or new.plan_id is distinct from old.plan_id or (new.teacher_id is distinct from old.teacher_id and new.teacher_compensation_snapshotted_at is null) then
    select * into v_plan from public.plans p where p.id = new.plan_id;
    if v_plan.id is not null then
      new.teacher_compensation_model := v_plan.teacher_compensation_model;
      new.teacher_compensation_base_value := case v_plan.teacher_compensation_model
        when 'fixed_monthly' then v_plan.teacher_compensation_fixed_amount
        when 'percent_plan' then v_plan.teacher_compensation_percent
        when 'per_meeting' then v_plan.teacher_compensation_per_meeting
        else null end;
      new.teacher_compensation_meeting_limit := coalesce(v_plan.teacher_compensation_meeting_limit, v_plan.meetings_per_month);
      new.teacher_compensation_plan_price := coalesce(new.agreed_monthly_price, v_plan.monthly_price);
      new.teacher_compensation_delivery_mode := v_plan.delivery_mode;
      new.teacher_compensation_snapshotted_at := now();
    end if;
  end if;
  return new;
end $$;

drop trigger if exists snapshot_subscription_teacher_compensation on public.subscriptions;
create trigger snapshot_subscription_teacher_compensation
before insert or update of plan_id, student_id, teacher_id on public.subscriptions
for each row execute function private.snapshot_subscription_teacher_compensation();

create table if not exists public.teacher_assignment_history (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete restrict,
  student_id uuid references public.students(id) on delete restrict,
  previous_teacher_id uuid references public.teachers(id) on delete restrict,
  new_teacher_id uuid references public.teachers(id) on delete restrict,
  changed_by_user_id uuid references auth.users(id) on delete set null,
  reason text not null default 'Atualização administrativa da matrícula',
  created_at timestamptz not null default now()
);
create index if not exists teacher_assignment_history_subscription_idx on public.teacher_assignment_history(subscription_id, created_at desc);
alter table public.teacher_assignment_history enable row level security;
drop policy if exists teacher_assignment_history_admin_read on public.teacher_assignment_history;
create policy teacher_assignment_history_admin_read on public.teacher_assignment_history
for select to authenticated using (private.has_role('admin'::app_role));
revoke all on public.teacher_assignment_history from anon;
grant select on public.teacher_assignment_history to authenticated;

create or replace function private.log_subscription_teacher_change()
returns trigger language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if new.teacher_id is distinct from old.teacher_id then
    insert into public.teacher_assignment_history(subscription_id, student_id, previous_teacher_id, new_teacher_id, changed_by_user_id)
    values (new.id, new.student_id, old.teacher_id, new.teacher_id, auth.uid());
  end if;
  return new;
end $$;
drop trigger if exists log_subscription_teacher_change on public.subscriptions;
create trigger log_subscription_teacher_change
after update of teacher_id on public.subscriptions
for each row execute function private.log_subscription_teacher_change();

create table if not exists public.teacher_payouts (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  guardian_id uuid not null references public.guardians(id) on delete restrict,
  subscription_id uuid not null references public.subscriptions(id) on delete restrict,
  plan_id uuid not null references public.plans(id) on delete restrict,
  family_payment_id uuid references public.payments(id) on delete restrict,
  reference_month date not null,
  family_amount numeric(12,2) not null,
  compensation_model text not null,
  base_value numeric(12,4) not null,
  expected_meetings integer not null default 0,
  completed_meetings integer not null default 0,
  billable_meetings integer not null default 0,
  calculated_amount numeric(12,2) not null default 0,
  adjustment_amount numeric(12,2) not null default 0,
  final_amount numeric(12,2) not null default 0,
  delivery_mode text,
  status text not null default 'pending',
  calculation_details jsonb not null default '{}'::jsonb,
  admin_note text,
  adjustment_reason text,
  approved_at timestamptz,
  approved_by_user_id uuid references auth.users(id) on delete set null,
  paid_at timestamptz,
  paid_by_user_id uuid references auth.users(id) on delete set null,
  blocked_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(subscription_id, reference_month),
  constraint teacher_payouts_reference_month_check check (reference_month = date_trunc('month', reference_month)::date),
  constraint teacher_payouts_model_check check (compensation_model in ('fixed_monthly','percent_plan','per_meeting')),
  constraint teacher_payouts_status_check check (status in ('pending','review','approved','paid','cancelled','blocked')),
  constraint teacher_payouts_nonnegative_check check (family_amount >= 0 and base_value >= 0 and expected_meetings >= 0 and completed_meetings >= 0 and billable_meetings >= 0 and calculated_amount >= 0 and final_amount >= 0),
  constraint teacher_payouts_final_not_above_family_check check (final_amount <= family_amount)
);
create index if not exists teacher_payouts_teacher_month_idx on public.teacher_payouts(teacher_id, reference_month desc);
create index if not exists teacher_payouts_status_month_idx on public.teacher_payouts(status, reference_month desc);
alter table public.teacher_payouts enable row level security;
drop policy if exists teacher_payouts_admin_all on public.teacher_payouts;
create policy teacher_payouts_admin_all on public.teacher_payouts
for all to authenticated using (private.has_role('admin'::app_role)) with check (private.has_role('admin'::app_role));
drop policy if exists teacher_payouts_teacher_read on public.teacher_payouts;
create policy teacher_payouts_teacher_read on public.teacher_payouts
for select to authenticated using (teacher_id = private.teacher_id_for_user());
revoke all on public.teacher_payouts from anon;
grant select, insert, update on public.teacher_payouts to authenticated;

create table if not exists public.teacher_payout_audit (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references public.teacher_payouts(id) on delete restrict,
  action text not null,
  previous_data jsonb,
  new_data jsonb,
  reason text,
  changed_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists teacher_payout_audit_payout_idx on public.teacher_payout_audit(payout_id, created_at desc);
alter table public.teacher_payout_audit enable row level security;
drop policy if exists teacher_payout_audit_admin_read on public.teacher_payout_audit;
create policy teacher_payout_audit_admin_read on public.teacher_payout_audit
for select to authenticated using (private.has_role('admin'::app_role));
revoke all on public.teacher_payout_audit from anon;
grant select on public.teacher_payout_audit to authenticated;

create or replace function private.audit_teacher_payout_change()
returns trigger language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  v_action text;
  v_reason text;
begin
  v_action := case when tg_op = 'INSERT' then 'created' else 'updated' end;
  v_reason := case when tg_op = 'UPDATE' then coalesce(new.adjustment_reason, new.admin_note) else null end;
  insert into public.teacher_payout_audit(payout_id, action, previous_data, new_data, reason, changed_by_user_id)
  values (new.id, v_action, case when tg_op = 'UPDATE' then to_jsonb(old) else null end, to_jsonb(new), v_reason, auth.uid());
  return new;
end $$;
drop trigger if exists audit_teacher_payout_change on public.teacher_payouts;
create trigger audit_teacher_payout_change
after insert or update on public.teacher_payouts
for each row execute function private.audit_teacher_payout_change();

create or replace function public.bootstrap_legacy_subscription_compensation(p_plan_id uuid)
returns integer language plpgsql security invoker set search_path = public, private, pg_temp as $$
declare
  v_plan public.plans%rowtype;
  v_count integer;
begin
  if not private.has_role('admin'::app_role) then raise exception 'admin required'; end if;
  select * into v_plan from public.plans where id = p_plan_id;
  if v_plan.id is null then raise exception 'plan not found'; end if;
  update public.subscriptions s set
    teacher_compensation_model = v_plan.teacher_compensation_model,
    teacher_compensation_base_value = case v_plan.teacher_compensation_model
      when 'fixed_monthly' then v_plan.teacher_compensation_fixed_amount
      when 'percent_plan' then v_plan.teacher_compensation_percent
      when 'per_meeting' then v_plan.teacher_compensation_per_meeting
      else null end,
    teacher_compensation_meeting_limit = coalesce(v_plan.teacher_compensation_meeting_limit, v_plan.meetings_per_month),
    teacher_compensation_plan_price = s.agreed_monthly_price,
    teacher_compensation_delivery_mode = v_plan.delivery_mode,
    teacher_compensation_snapshotted_at = now(),
    updated_at = now()
  where s.plan_id = p_plan_id and s.teacher_compensation_snapshotted_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke all on function public.bootstrap_legacy_subscription_compensation(uuid) from public, anon;
grant execute on function public.bootstrap_legacy_subscription_compensation(uuid) to authenticated;

create or replace function public.generate_teacher_payouts(p_reference_month date)
returns integer language plpgsql security invoker set search_path = public, private, pg_temp as $$
declare
  v_month date := date_trunc('month', coalesce(p_reference_month, current_date))::date;
  v_next_month date := (date_trunc('month', coalesce(p_reference_month, current_date)) + interval '1 month')::date;
  v_row record;
  v_completed integer;
  v_billable integer;
  v_expected integer;
  v_calculated numeric(12,2);
  v_status text;
  v_existing_status text;
  v_count integer := 0;
begin
  if not private.has_role('admin'::app_role) then raise exception 'admin required'; end if;

  update public.teacher_payouts tp
  set status = 'blocked', blocked_at = coalesce(blocked_at, now()),
      admin_note = coalesce(admin_note, 'Mensalidade da família não está confirmada para esta competência.'),
      updated_at = now()
  where tp.reference_month = v_month and tp.status in ('pending','review')
    and not exists (
      select 1 from public.payments p
      where p.subscription_id = tp.subscription_id and p.status = 'paid'
        and p.due_date >= v_month and p.due_date < v_next_month
    );

  for v_row in
    select distinct on (s.id)
      s.id as subscription_id, s.guardian_id, s.student_id, s.plan_id, s.teacher_id,
      s.teacher_compensation_model, s.teacher_compensation_base_value,
      coalesce(s.teacher_compensation_meeting_limit, 0) as meeting_limit,
      s.teacher_compensation_delivery_mode,
      p.id as payment_id, p.amount as payment_amount
    from public.subscriptions s
    join public.payments p on p.subscription_id = s.id
    where p.status = 'paid'
      and p.due_date >= v_month and p.due_date < v_next_month
      and s.teacher_id is not null and s.student_id is not null
      and s.teacher_compensation_model in ('fixed_monthly','percent_plan','per_meeting')
      and coalesce(s.teacher_compensation_base_value, 0) > 0
      and (s.starts_at is null or s.starts_at < v_next_month)
      and (s.ends_at is null or s.ends_at >= v_month)
    order by s.id, p.paid_at desc nulls last, p.created_at desc
  loop
    select tp.status into v_existing_status
    from public.teacher_payouts tp
    where tp.subscription_id = v_row.subscription_id and tp.reference_month = v_month;
    if v_existing_status in ('approved','paid','cancelled') then continue; end if;

    select count(distinct ae.id)::int into v_completed
    from public.agenda_events ae
    join public.agenda_event_students aes on aes.event_id = ae.id
    where ae.created_by_teacher_id = v_row.teacher_id
      and aes.student_id = v_row.student_id
      and ae.status = 'completed'
      and ae.event_type in ('meeting','class','review')
      and ae.starts_at >= v_month::timestamptz
      and ae.starts_at < v_next_month::timestamptz;

    v_expected := greatest(coalesce(v_row.meeting_limit, 0), 0);
    v_billable := case when v_expected > 0 then least(coalesce(v_completed, 0), v_expected) else coalesce(v_completed, 0) end;
    v_calculated := case v_row.teacher_compensation_model
      when 'fixed_monthly' then case when coalesce(v_completed,0) > 0 then least(v_row.payment_amount, v_row.teacher_compensation_base_value)::numeric(12,2) else 0 end
      when 'percent_plan' then case when coalesce(v_completed,0) > 0 then least(v_row.payment_amount, round(v_row.payment_amount * v_row.teacher_compensation_base_value / 100, 2))::numeric(12,2) else 0 end
      when 'per_meeting' then least(v_row.payment_amount, round(v_row.teacher_compensation_base_value * v_billable, 2))::numeric(12,2)
      else 0 end;
    v_status := case when v_calculated > 0 then 'review' else 'blocked' end;

    insert into public.teacher_payouts(
      teacher_id, student_id, guardian_id, subscription_id, plan_id, family_payment_id,
      reference_month, family_amount, compensation_model, base_value, expected_meetings,
      completed_meetings, billable_meetings, calculated_amount, adjustment_amount,
      final_amount, delivery_mode, status, calculation_details, blocked_at, updated_at
    ) values (
      v_row.teacher_id, v_row.student_id, v_row.guardian_id, v_row.subscription_id, v_row.plan_id, v_row.payment_id,
      v_month, v_row.payment_amount, v_row.teacher_compensation_model, v_row.teacher_compensation_base_value,
      v_expected, coalesce(v_completed,0), v_billable, v_calculated, 0, v_calculated,
      v_row.teacher_compensation_delivery_mode, v_status,
      jsonb_build_object(
        'payment_confirmed',true,
        'eligible_event_status','completed',
        'eligible_event_types',jsonb_build_array('meeting','class','review'),
        'completed_meetings',coalesce(v_completed,0),
        'billable_meetings',v_billable,
        'meeting_limit',v_expected,
        'model',v_row.teacher_compensation_model,
        'base_value',v_row.teacher_compensation_base_value,
        'family_amount',v_row.payment_amount
      ),
      case when v_status='blocked' then now() else null end,
      now()
    )
    on conflict (subscription_id, reference_month) do update set
      family_payment_id=excluded.family_payment_id,
      family_amount=excluded.family_amount,
      teacher_id=excluded.teacher_id,
      student_id=excluded.student_id,
      guardian_id=excluded.guardian_id,
      plan_id=excluded.plan_id,
      compensation_model=excluded.compensation_model,
      base_value=excluded.base_value,
      expected_meetings=excluded.expected_meetings,
      completed_meetings=excluded.completed_meetings,
      billable_meetings=excluded.billable_meetings,
      calculated_amount=excluded.calculated_amount,
      final_amount=least(excluded.family_amount, greatest(0, excluded.calculated_amount + teacher_payouts.adjustment_amount)),
      delivery_mode=excluded.delivery_mode,
      status=excluded.status,
      calculation_details=excluded.calculation_details,
      blocked_at=excluded.blocked_at,
      updated_at=now()
    where teacher_payouts.status in ('pending','review','blocked');
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
revoke all on function public.generate_teacher_payouts(date) from public, anon;
grant execute on function public.generate_teacher_payouts(date) to authenticated;

-- Indicação de professor registra origem e conversão, mas não cria bônus financeiro automático.
create or replace function private.confirm_referral_from_payment()
returns trigger language plpgsql security definer set search_path = public, private, pg_temp as $$
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
  if v_code.owner_type='teacher' then return new; end if;

  select * into v_settings
  from public.referral_program_settings
  where owner_type='guardian'
  limit 1;
  if not coalesce(private.referral_program_is_active(v_settings),false) or v_settings.benefit_type='none' then return new; end if;

  select count(*)::int into v_confirmed_count
  from public.referrals
  where referral_code_id=v_code.id and status='payment_confirmed';
  if v_confirmed_count % greatest(v_settings.required_confirmed_referrals,1) <> 0 then return new; end if;

  if v_code.guardian_id is not null then
    insert into public.referral_benefits(
      referral_id,beneficiary_guardian_id,beneficiary_teacher_id,
      benefit_type,benefit_percent,benefit_amount,extra_resource_key,status
    ) values (
      v_ref.id,v_code.guardian_id,null,v_settings.benefit_type,
      v_settings.benefit_percent,v_settings.benefit_amount,v_settings.extra_resource_key,'available'
    ) on conflict(referral_id) do nothing;
  end if;
  return new;
end $$;
