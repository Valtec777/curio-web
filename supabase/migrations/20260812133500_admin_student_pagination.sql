-- CURIÓ — paginação do diretório administrativo de alunos.
-- Mantém exatamente os filtros existentes e executa filtro/contagem no banco.

create or replace function public.admin_student_page(
  p_status text default 'all',
  p_offset integer default 0,
  p_limit integer default 20
)
returns table (
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
security invoker
set search_path = public, private, pg_temp
as $$
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
    s.status,
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
$$;

revoke all on function public.admin_student_page(text, integer, integer) from public, anon;
grant execute on function public.admin_student_page(text, integer, integer) to authenticated;

create or replace function public.admin_student_filter_counts()
returns table (
  all_count bigint,
  active_count bigint,
  paused_count bigint,
  inactive_count bigint,
  no_enrollment_count bigint
)
language plpgsql
stable
security invoker
set search_path = public, private, pg_temp
as $$
begin
  if not private.has_role('admin'::public.app_role) then
    raise exception 'admin required';
  end if;

  return query
  select
    count(*) filter (where s.deleted_at is null),
    count(*) filter (where s.deleted_at is null and s.status in ('active', 'pilot')),
    count(*) filter (where s.deleted_at is null and s.status = 'paused'),
    count(*) filter (where s.deleted_at is null and s.status = 'inactive'),
    count(*) filter (
      where s.deleted_at is null
        and not exists (
          select 1
          from public.subscriptions sub
          where sub.student_id = s.id
        )
    )
  from public.students s;
end
$$;

revoke all on function public.admin_student_filter_counts() from public, anon;
grant execute on function public.admin_student_filter_counts() to authenticated;
