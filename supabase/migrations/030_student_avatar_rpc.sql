-- CURIÓ · Troca segura do avatar
-- A função altera somente avatar_character_id; não abre UPDATE de estrelas, nível ou streak para aluno/família.

create or replace function public.set_student_avatar(p_student_id uuid,p_character_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if not (
    exists (
      select 1 from public.students s
      where s.id=p_student_id
        and s.deleted_at is null
        and s.auth_user_id=(select auth.uid())
    )
    or private.guardian_has_student(p_student_id)
  ) then
    raise exception 'student access required';
  end if;

  if not exists (
    select 1 from public.characters c
    where c.id=p_character_id
      and c.active=true
      and coalesce(c.assets->>'avatar','')<>''
  ) then
    raise exception 'avatar unavailable';
  end if;

  insert into public.student_game_profiles(student_id,avatar_character_id,updated_at)
  values(p_student_id,p_character_id,now())
  on conflict(student_id)
  do update set avatar_character_id=excluded.avatar_character_id,updated_at=now();

  return p_character_id;
end;
$$;

revoke all on function public.set_student_avatar(uuid,uuid) from public;
grant execute on function public.set_student_avatar(uuid,uuid) to authenticated;
