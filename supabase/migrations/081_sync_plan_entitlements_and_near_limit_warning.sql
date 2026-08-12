-- CURIÓ · Sincroniza novos planos com o motor de limites e melhora o aviso de proximidade.

create or replace function private.seed_plan_entitlements_from_plan() returns trigger
language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
  insert into public.plan_entitlements(plan_id,resource_key,limit_per_cycle,enabled,hard_limit,warning_percent)
  values(new.id,'meetings',case when new.meetings_per_month > 0 then new.meetings_per_month else 0 end,new.meetings_per_month > 0,true,80)
  on conflict(plan_id,resource_key) do update
    set limit_per_cycle=excluded.limit_per_cycle,
        enabled=excluded.enabled,
        hard_limit=true,
        updated_at=now();

  insert into public.plan_entitlements(plan_id,resource_key,limit_per_cycle,enabled,hard_limit,warning_percent)
  select new.id,r.resource_key,null,true,false,80
  from (values ('missions'),('assessments'),('notebooks'),('materials'),('courses')) r(resource_key)
  on conflict(plan_id,resource_key) do nothing;
  return new;
end $$;

drop trigger if exists trg_seed_plan_entitlements on public.plans;
create trigger trg_seed_plan_entitlements
after insert or update of meetings_per_month on public.plans
for each row execute function private.seed_plan_entitlements_from_plan();

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
    when e.limit_per_cycle > 0 and coalesce(u.used_units,0) > 0 and (
      e.limit_per_cycle-coalesce(u.used_units,0) <= 1
      or (coalesce(u.used_units,0)*100.0/e.limit_per_cycle) >= e.warning_percent
    ) then 'warning'
    else 'ok'
  end
from bounds b
join public.plan_entitlements e on e.plan_id=b.plan_id
left join usage u on u.subscription_id=b.id and u.resource_key=e.resource_key
order by b.student_id,e.resource_key;
$$;
