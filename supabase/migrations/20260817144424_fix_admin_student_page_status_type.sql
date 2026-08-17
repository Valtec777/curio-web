create or replace function public.admin_student_page(
  p_status text default 'all'::text,
  p_offset integer default 0,
  p_limit integer default 20
)
returns table(
  student_id uuid,
  full_name text,
  preferred_name text,
  school_name text,
  grade_id uuid,
  status text,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
stable
set search_path to 'public', 'private', 'pg_temp'
as $function$
begin
  if not private.has_role('admin'::public.app_role) then
    raise exception 'admin required';
  end if;

  if p_status not in ('all', 'active', 'paused', 'inactive', 'no_enrollment') then
    raise exception 'invalid filter';
  end if;

  return query
  select
    s.id,
    s.full_name,
    s.preferred_name,
    s.school_name,
    s.grade_id,
    s.status::text,
    s.created_at,
    count(*) over() as total_count
  from public.students s
  where s.deleted_at is null
    and (
      p_status = 'all'
      or (p_status = 'active' and s.status in ('active', 'pilot'))
      or (p_status = 'paused' and s.status = 'paused')
      or (p_status = 'inactive' and s.status = 'inactive')
      or (
        p_status = 'no_enrollment'
        and not exists (
          select 1
          from public.subscriptions sub
          where sub.student_id = s.id
        )
      )
    )
  order by coalesce(nullif(s.preferred_name, ''), s.full_name), s.id
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
end
$function$;
