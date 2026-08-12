-- CURIÓ · Planos configuráveis, ciclos e consumo real

create table if not exists public.plan_entitlements (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  resource_key text not null check (resource_key in ('meetings','missions','assessments','notebooks','materials','courses')),
  limit_per_cycle integer check (limit_per_cycle is null or limit_per_cycle >= 0),
  enabled boolean not null default true,
  hard_limit boolean not null default true,
  warning_percent smallint not null default 80 check (warning_percent between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(plan_id, resource_key)
);

create table if not exists public.subscription_usage_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  resource_key text not null check (resource_key in ('meetings','missions','assessments','notebooks','materials','courses')),
  source_type text not null,
  source_id uuid not null,
  units integer not null default 1 check (units > 0),
  occurred_at timestamptz not null default now(),
  cycle_start date not null,
  cycle_end date not null,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  reversed_at timestamptz,
  reversal_reason text,
  created_at timestamptz not null default now(),
  unique(subscription_id, resource_key, source_type, source_id)
);

create index if not exists plan_entitlements_plan_idx on public.plan_entitlements(plan_id, resource_key);
create index if not exists subscription_usage_cycle_idx on public.subscription_usage_events(subscription_id, resource_key, cycle_start, cycle_end) where reversed_at is null;
create index if not exists subscription_usage_student_idx on public.subscription_usage_events(student_id, occurred_at desc);

alter table public.plan_entitlements enable row level security;
alter table public.subscription_usage_events enable row level security;

drop policy if exists plan_entitlements_read on public.plan_entitlements;
create policy plan_entitlements_read on public.plan_entitlements for select to authenticated using (true);
drop policy if exists plan_entitlements_admin_write on public.plan_entitlements;
create policy plan_entitlements_admin_write on public.plan_entitlements for all to authenticated
using (private.has_role('admin'::app_role)) with check (private.has_role('admin'::app_role));

drop policy if exists subscription_usage_read on public.subscription_usage_events;
create policy subscription_usage_read on public.subscription_usage_events for select to authenticated
using (
  private.has_role('admin'::app_role)
  or private.teacher_has_student(student_id)
  or private.guardian_can_view_progress(student_id)
  or exists(select 1 from public.students s where s.id=student_id and s.auth_user_id=(select auth.uid()) and s.deleted_at is null)
);

revoke insert, update, delete on public.subscription_usage_events from anon, authenticated;
grant select on public.subscription_usage_events to authenticated;
grant select on public.plan_entitlements to authenticated;

insert into public.plan_entitlements(plan_id,resource_key,limit_per_cycle,enabled,hard_limit,warning_percent)
select p.id,'meetings',case when p.meetings_per_month > 0 then p.meetings_per_month else null end,true,true,80
from public.plans p
on conflict(plan_id,resource_key) do update
set limit_per_cycle=excluded.limit_per_cycle, updated_at=now();

insert into public.plan_entitlements(plan_id,resource_key,limit_per_cycle,enabled,hard_limit,warning_percent)
select p.id,r.resource_key,null,true,false,80
from public.plans p
cross join (values ('missions'),('assessments'),('notebooks'),('materials'),('courses')) r(resource_key)
on conflict(plan_id,resource_key) do nothing;

create or replace function private.subscription_cycle_bounds(p_start date, p_on date)
returns table(cycle_start date, cycle_end date, renews_on date)
language plpgsql stable security definer set search_path=public,private,pg_temp as $$
declare
  v_start date := coalesce(p_start,p_on);
  v_months integer;
  v_candidate date;
  v_next date;
begin
  if p_on < v_start then
    cycle_start := v_start;
    renews_on := (v_start + interval '1 month')::date;
    cycle_end := renews_on - 1;
    return next;
    return;
  end if;

  v_months := ((extract(year from p_on)::int - extract(year from v_start)::int) * 12)
              + (extract(month from p_on)::int - extract(month from v_start)::int);
  v_candidate := (v_start + make_interval(months => v_months))::date;
  if v_candidate > p_on then
    v_months := greatest(0,v_months - 1);
    v_candidate := (v_start + make_interval(months => v_months))::date;
  end if;
  v_next := (v_start + make_interval(months => v_months + 1))::date;

  cycle_start := v_candidate;
  cycle_end := v_next - 1;
  renews_on := v_next;
  return next;
end; $$;

create or replace function private.record_plan_usage(
  p_student_id uuid,
  p_resource_key text,
  p_source_type text,
  p_source_id uuid,
  p_occurred_at timestamptz default now(),
  p_units integer default 1
) returns void
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  v_subscription public.subscriptions%rowtype;
  v_entitlement public.plan_entitlements%rowtype;
  v_cycle_start date;
  v_cycle_end date;
  v_renews_on date;
  v_used integer := 0;
  v_existing public.subscription_usage_events%rowtype;
  v_local_date date := (p_occurred_at at time zone 'America/Bahia')::date;
begin
  if p_units <= 0 then return; end if;

  select s.* into v_subscription
  from public.subscriptions s
  where s.student_id=p_student_id
    and s.status in ('active','pending','paused')
    and (s.starts_at is null or s.starts_at <= v_local_date)
    and (s.ends_at is null or s.ends_at >= v_local_date)
  order by case s.status when 'active' then 1 when 'pending' then 2 else 3 end,
           coalesce(s.starts_at,s.created_at::date) desc,
           s.created_at desc
  limit 1;

  if v_subscription.id is null then return; end if;
  if v_subscription.status='paused' then
    raise exception 'PLAN_ACCESS_PAUSED|%|%',p_resource_key,p_student_id using errcode='P0001';
  end if;

  select * into v_entitlement
  from public.plan_entitlements e
  where e.plan_id=v_subscription.plan_id and e.resource_key=p_resource_key;

  if v_entitlement.id is null then return; end if;
  if not v_entitlement.enabled then
    raise exception 'PLAN_RESOURCE_NOT_INCLUDED|%|%',p_resource_key,p_student_id using errcode='P0001';
  end if;

  select b.cycle_start,b.cycle_end,b.renews_on
  into v_cycle_start,v_cycle_end,v_renews_on
  from private.subscription_cycle_bounds(coalesce(v_subscription.starts_at,v_subscription.created_at::date),v_local_date) b;

  select * into v_existing
  from public.subscription_usage_events u
  where u.subscription_id=v_subscription.id
    and u.resource_key=p_resource_key
    and u.source_type=p_source_type
    and u.source_id=p_source_id
  limit 1;

  if v_existing.id is not null and v_existing.reversed_at is null then return; end if;

  select coalesce(sum(u.units),0)::int into v_used
  from public.subscription_usage_events u
  where u.subscription_id=v_subscription.id
    and u.resource_key=p_resource_key
    and u.cycle_start=v_cycle_start
    and u.cycle_end=v_cycle_end
    and u.reversed_at is null;

  if v_entitlement.limit_per_cycle is not null
     and v_entitlement.hard_limit
     and v_used + p_units > v_entitlement.limit_per_cycle then
    raise exception 'PLAN_LIMIT_REACHED|%|%|%|%',p_resource_key,v_used,v_entitlement.limit_per_cycle,v_renews_on using errcode='P0001';
  end if;

  if v_existing.id is not null then
    update public.subscription_usage_events
    set units=p_units, occurred_at=p_occurred_at, cycle_start=v_cycle_start, cycle_end=v_cycle_end,
        reversed_at=null, reversal_reason=null, created_by_user_id=coalesce((select auth.uid()),created_by_user_id)
    where id=v_existing.id;
  else
    insert into public.subscription_usage_events(
      subscription_id,student_id,resource_key,source_type,source_id,units,occurred_at,cycle_start,cycle_end,created_by_user_id
    ) values(
      v_subscription.id,p_student_id,p_resource_key,p_source_type,p_source_id,p_units,p_occurred_at,v_cycle_start,v_cycle_end,(select auth.uid())
    );
  end if;
end; $$;

create or replace function private.reverse_plan_usage(p_student_id uuid,p_source_type text,p_source_id uuid,p_reason text)
returns void language sql security definer set search_path=public,private,pg_temp as $$
  update public.subscription_usage_events
  set reversed_at=coalesce(reversed_at,now()), reversal_reason=coalesce(reversal_reason,p_reason)
  where source_type=p_source_type and source_id=p_source_id
    and (p_student_id is null or student_id=p_student_id)
    and reversed_at is null;
$$;

create or replace function private.consume_mission_assignment() returns trigger
language plpgsql security definer set search_path=public,private,pg_temp as $$ begin
  perform private.record_plan_usage(new.student_id,'missions','mission',new.mission_id,coalesce(new.assigned_at,now()),1);
  return new;
end $$;
drop trigger if exists trg_plan_consume_mission on public.mission_students;
create trigger trg_plan_consume_mission before insert on public.mission_students for each row execute function private.consume_mission_assignment();

create or replace function private.consume_assessment_assignment() returns trigger
language plpgsql security definer set search_path=public,private,pg_temp as $$ begin
  perform private.record_plan_usage(new.student_id,'assessments','assessment',new.assessment_id,coalesce(new.created_at,now()),1);
  return new;
end $$;
drop trigger if exists trg_plan_consume_assessment on public.assessment_students;
create trigger trg_plan_consume_assessment before insert on public.assessment_students for each row execute function private.consume_assessment_assignment();

create or replace function private.consume_notebook_assignment() returns trigger
language plpgsql security definer set search_path=public,private,pg_temp as $$ begin
  perform private.record_plan_usage(new.student_id,'notebooks','notebook',new.activity_id,coalesce(new.created_at,now()),1);
  return new;
end $$;
drop trigger if exists trg_plan_consume_notebook on public.notebook_assignments;
create trigger trg_plan_consume_notebook before insert on public.notebook_assignments for each row execute function private.consume_notebook_assignment();

create or replace function private.consume_material_assignment() returns trigger
language plpgsql security definer set search_path=public,private,pg_temp as $$ begin
  if new.student_id is not null then
    perform private.record_plan_usage(new.student_id,'materials','material',new.material_id,coalesce(new.assigned_at,now()),1);
  end if;
  return new;
end $$;
drop trigger if exists trg_plan_consume_material on public.material_assignments;
create trigger trg_plan_consume_material before insert on public.material_assignments for each row execute function private.consume_material_assignment();

create or replace function private.consume_course_enrollment() returns trigger
language plpgsql security definer set search_path=public,private,pg_temp as $$ begin
  perform private.record_plan_usage(new.student_id,'courses','course',new.course_id,coalesce(new.started_at,now()),1);
  return new;
end $$;
drop trigger if exists trg_plan_consume_course on public.free_course_enrollments;
create trigger trg_plan_consume_course before insert on public.free_course_enrollments for each row execute function private.consume_course_enrollment();

create or replace function private.consume_agenda_student() returns trigger
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_event public.agenda_events%rowtype;
begin
  select * into v_event from public.agenda_events where id=new.event_id;
  if v_event.id is not null and v_event.status <> 'cancelled' and v_event.event_type in ('class','review') then
    perform private.record_plan_usage(new.student_id,'meetings','agenda_event',new.event_id,v_event.starts_at,1);
  end if;
  return new;
end $$;
drop trigger if exists trg_plan_consume_agenda on public.agenda_event_students;
create trigger trg_plan_consume_agenda before insert on public.agenda_event_students for each row execute function private.consume_agenda_student();

create or replace function private.reverse_cancelled_agenda_usage() returns trigger
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_student uuid;
begin
  if new.status='cancelled' and old.status is distinct from 'cancelled' then
    perform private.reverse_plan_usage(null,'agenda_event',new.id,'agenda_cancelled');
  end if;
  if old.status='cancelled' and new.status<>'cancelled' and new.event_type in ('class','review') then
    for v_student in select a.student_id from public.agenda_event_students a where a.event_id=new.id loop
      perform private.record_plan_usage(v_student,'meetings','agenda_event',new.id,new.starts_at,1);
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists trg_plan_reverse_cancelled_agenda on public.agenda_events;
create trigger trg_plan_reverse_cancelled_agenda after update of status on public.agenda_events for each row execute function private.reverse_cancelled_agenda_usage();

create or replace function private.reverse_assignment_usage() returns trigger
language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
  if tg_table_name='mission_students' then perform private.reverse_plan_usage(old.student_id,'mission',old.mission_id,'assignment_removed');
  elsif tg_table_name='assessment_students' then perform private.reverse_plan_usage(old.student_id,'assessment',old.assessment_id,'assignment_removed');
  elsif tg_table_name='notebook_assignments' then perform private.reverse_plan_usage(old.student_id,'notebook',old.activity_id,'assignment_removed');
  elsif tg_table_name='material_assignments' then perform private.reverse_plan_usage(old.student_id,'material',old.material_id,'assignment_removed');
  elsif tg_table_name='free_course_enrollments' then perform private.reverse_plan_usage(old.student_id,'course',old.course_id,'enrollment_removed');
  elsif tg_table_name='agenda_event_students' then perform private.reverse_plan_usage(old.student_id,'agenda_event',old.event_id,'agenda_student_removed');
  end if;
  return old;
end $$;

drop trigger if exists trg_plan_reverse_mission on public.mission_students;
create trigger trg_plan_reverse_mission after delete on public.mission_students for each row execute function private.reverse_assignment_usage();
drop trigger if exists trg_plan_reverse_assessment on public.assessment_students;
create trigger trg_plan_reverse_assessment after delete on public.assessment_students for each row execute function private.reverse_assignment_usage();
drop trigger if exists trg_plan_reverse_notebook on public.notebook_assignments;
create trigger trg_plan_reverse_notebook after delete on public.notebook_assignments for each row execute function private.reverse_assignment_usage();
drop trigger if exists trg_plan_reverse_material on public.material_assignments;
create trigger trg_plan_reverse_material after delete on public.material_assignments for each row execute function private.reverse_assignment_usage();
drop trigger if exists trg_plan_reverse_course on public.free_course_enrollments;
create trigger trg_plan_reverse_course after delete on public.free_course_enrollments for each row execute function private.reverse_assignment_usage();
drop trigger if exists trg_plan_reverse_agenda_student on public.agenda_event_students;
create trigger trg_plan_reverse_agenda_student after delete on public.agenda_event_students for each row execute function private.reverse_assignment_usage();

create or replace function private.plan_consumption_rows(p_student_ids uuid[])
returns table(
  student_id uuid,
  subscription_id uuid,
  plan_id uuid,
  plan_name text,
  subscription_status text,
  cycle_start date,
  cycle_end date,
  renews_on date,
  resource_key text,
  used_units integer,
  limit_per_cycle integer,
  remaining_units integer,
  enabled boolean,
  hard_limit boolean,
  warning_percent smallint,
  usage_state text
)
language sql stable security definer set search_path=public,private,pg_temp as $$
with chosen as (
  select distinct on (s.student_id)
    s.id,s.student_id,s.plan_id,s.status,s.starts_at,s.created_at,p.name as plan_name
  from public.subscriptions s
  join public.plans p on p.id=s.plan_id
  where s.student_id=any(p_student_ids)
    and s.status in ('active','pending','paused')
    and (s.starts_at is null or s.starts_at <= current_date)
    and (s.ends_at is null or s.ends_at >= current_date)
  order by s.student_id,case s.status when 'active' then 1 when 'pending' then 2 else 3 end,coalesce(s.starts_at,s.created_at::date) desc,s.created_at desc
), bounds as (
  select c.*,b.cycle_start,b.cycle_end,b.renews_on
  from chosen c
  cross join lateral private.subscription_cycle_bounds(coalesce(c.starts_at,c.created_at::date),current_date) b
), usage as (
  select u.subscription_id,u.resource_key,coalesce(sum(u.units),0)::int as used_units
  from public.subscription_usage_events u
  join bounds b on b.id=u.subscription_id and u.cycle_start=b.cycle_start and u.cycle_end=b.cycle_end
  where u.reversed_at is null
  group by u.subscription_id,u.resource_key
)
select
  b.student_id,b.id,b.plan_id,b.plan_name,b.status,b.cycle_start,b.cycle_end,b.renews_on,
  e.resource_key,coalesce(u.used_units,0)::int,e.limit_per_cycle,
  case when e.limit_per_cycle is null then null else greatest(e.limit_per_cycle-coalesce(u.used_units,0),0) end,
  e.enabled,e.hard_limit,e.warning_percent,
  case
    when b.status='paused' then 'paused'
    when not e.enabled then 'blocked'
    when e.limit_per_cycle is null then 'unlimited'
    when coalesce(u.used_units,0) >= e.limit_per_cycle then 'reached'
    when e.limit_per_cycle > 0 and (coalesce(u.used_units,0)*100.0/e.limit_per_cycle) >= e.warning_percent then 'warning'
    else 'ok'
  end
from bounds b
join public.plan_entitlements e on e.plan_id=b.plan_id
left join usage u on u.subscription_id=b.id and u.resource_key=e.resource_key
order by b.student_id,e.resource_key;
$$;

create or replace function public.plan_consumption_for_student(p_student_id uuid)
returns table(
  student_id uuid,subscription_id uuid,plan_id uuid,plan_name text,subscription_status text,
  cycle_start date,cycle_end date,renews_on date,resource_key text,used_units integer,
  limit_per_cycle integer,remaining_units integer,enabled boolean,hard_limit boolean,warning_percent smallint,usage_state text
)
language plpgsql stable security definer set search_path=public,private,pg_temp as $$
begin
  if not (
    private.has_role('admin'::app_role)
    or private.teacher_has_student(p_student_id)
    or private.guardian_can_view_progress(p_student_id)
    or exists(select 1 from public.students s where s.id=p_student_id and s.auth_user_id=(select auth.uid()) and s.deleted_at is null)
  ) then raise exception 'not allowed'; end if;
  return query select * from private.plan_consumption_rows(array[p_student_id]);
end $$;

create or replace function public.teacher_plan_consumption()
returns table(
  student_id uuid,subscription_id uuid,plan_id uuid,plan_name text,subscription_status text,
  cycle_start date,cycle_end date,renews_on date,resource_key text,used_units integer,
  limit_per_cycle integer,remaining_units integer,enabled boolean,hard_limit boolean,warning_percent smallint,usage_state text
)
language plpgsql stable security definer set search_path=public,private,pg_temp as $$
declare v_teacher uuid;
begin
  v_teacher:=private.teacher_id_for_user();
  if v_teacher is null then raise exception 'teacher required'; end if;
  return query select * from private.plan_consumption_rows(array(
    select ts.student_id from public.teacher_students ts join public.students s on s.id=ts.student_id
    where ts.teacher_id=v_teacher and ts.active=true and s.deleted_at is null
  ));
end $$;

create or replace function public.admin_plan_consumption()
returns table(
  student_id uuid,subscription_id uuid,plan_id uuid,plan_name text,subscription_status text,
  cycle_start date,cycle_end date,renews_on date,resource_key text,used_units integer,
  limit_per_cycle integer,remaining_units integer,enabled boolean,hard_limit boolean,warning_percent smallint,usage_state text
)
language plpgsql stable security definer set search_path=public,private,pg_temp as $$
begin
  if not private.has_role('admin'::app_role) then raise exception 'admin required'; end if;
  return query select * from private.plan_consumption_rows(array(
    select distinct s.student_id from public.subscriptions s where s.student_id is not null
  ));
end $$;

revoke all on function public.plan_consumption_for_student(uuid) from public,anon;
revoke all on function public.teacher_plan_consumption() from public,anon;
revoke all on function public.admin_plan_consumption() from public,anon;
grant execute on function public.plan_consumption_for_student(uuid) to authenticated;
grant execute on function public.teacher_plan_consumption() to authenticated;
grant execute on function public.admin_plan_consumption() to authenticated;

do $$ begin
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='touch_updated_at') then
    if not exists(select 1 from pg_trigger where tgname='trg_plan_entitlements_touch') then
      create trigger trg_plan_entitlements_touch before update on public.plan_entitlements for each row execute function public.touch_updated_at();
    end if;
  end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='audit_row_change') then
    if not exists(select 1 from pg_trigger where tgname='audit_plan_entitlements_changes') then
      create trigger audit_plan_entitlements_changes after insert or update or delete on public.plan_entitlements for each row execute function private.audit_row_change();
    end if;
  end if;
end $$;
