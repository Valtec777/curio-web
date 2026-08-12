-- CURIÓ · Backfill idempotente do consumo que já existia antes do motor de planos.
-- O histórico antigo é registrado, mas não é revalidado contra limites novos.

with raw_usage as (
  select ms.student_id, 'missions'::text resource_key, 'mission'::text source_type, ms.mission_id source_id, ms.assigned_at occurred_at
  from public.mission_students ms
  union all
  select a.student_id, 'assessments', 'assessment', a.assessment_id, a.created_at
  from public.assessment_students a
  union all
  select n.student_id, 'notebooks', 'notebook', n.activity_id, n.created_at
  from public.notebook_assignments n
  union all
  select m.student_id, 'materials', 'material', m.material_id, m.assigned_at
  from public.material_assignments m where m.student_id is not null
  union all
  select e.student_id, 'courses', 'course', e.course_id, e.started_at
  from public.free_course_enrollments e
  union all
  select aes.student_id, 'meetings', 'agenda_event', aes.event_id, ae.starts_at
  from public.agenda_event_students aes
  join public.agenda_events ae on ae.id=aes.event_id
  where ae.event_type in ('class','review') and ae.status<>'cancelled'
), resolved as (
  select r.*, s.id subscription_id, b.cycle_start, b.cycle_end
  from raw_usage r
  join lateral (
    select s0.*
    from public.subscriptions s0
    where s0.student_id=r.student_id
      and (s0.starts_at is null or s0.starts_at <= (r.occurred_at at time zone 'America/Bahia')::date)
      and (s0.ends_at is null or s0.ends_at >= (r.occurred_at at time zone 'America/Bahia')::date)
    order by coalesce(s0.starts_at,s0.created_at::date) desc,s0.created_at desc
    limit 1
  ) s on true
  cross join lateral private.subscription_cycle_bounds(
    coalesce(s.starts_at,s.created_at::date),
    (r.occurred_at at time zone 'America/Bahia')::date
  ) b
)
insert into public.subscription_usage_events(
  subscription_id,student_id,resource_key,source_type,source_id,units,occurred_at,cycle_start,cycle_end,created_by_user_id
)
select subscription_id,student_id,resource_key,source_type,source_id,1,occurred_at,cycle_start,cycle_end,null
from resolved
on conflict(subscription_id,resource_key,source_type,source_id) do nothing;
