-- CURIÓ · reordenação atômica de etapas do Modo Pensar

create or replace function public.move_free_course_module(p_module_id uuid, p_direction text)
returns boolean
language plpgsql
security invoker
set search_path=public,private,pg_temp
as $$
declare
  v_course_id uuid;
  v_position integer;
  v_adjacent_id uuid;
  v_adjacent_position integer;
  v_temp_position integer;
begin
  if not private.has_role('admin'::app_role) then
    raise exception 'admin role required';
  end if;
  if p_direction not in ('up','down') then
    raise exception 'invalid direction';
  end if;

  select m.course_id,m.position into v_course_id,v_position
  from public.free_course_modules m
  where m.id=p_module_id;
  if v_course_id is null then raise exception 'module not found'; end if;

  if p_direction='up' then
    select m.id,m.position into v_adjacent_id,v_adjacent_position
    from public.free_course_modules m
    where m.course_id=v_course_id and m.position<v_position
    order by m.position desc limit 1;
  else
    select m.id,m.position into v_adjacent_id,v_adjacent_position
    from public.free_course_modules m
    where m.course_id=v_course_id and m.position>v_position
    order by m.position asc limit 1;
  end if;

  if v_adjacent_id is null then return false; end if;
  select coalesce(max(m.position),0)+1 into v_temp_position from public.free_course_modules m where m.course_id=v_course_id;
  update public.free_course_modules set position=v_temp_position,updated_at=now() where id=p_module_id;
  update public.free_course_modules set position=v_position,updated_at=now() where id=v_adjacent_id;
  update public.free_course_modules set position=v_adjacent_position,updated_at=now() where id=p_module_id;
  return true;
end; $$;
revoke all on function public.move_free_course_module(uuid,text) from public,anon;
grant execute on function public.move_free_course_module(uuid,text) to authenticated;
