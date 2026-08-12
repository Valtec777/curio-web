-- CURIÓ · RLS de materiais e grupos pedagógicos
-- Corrige a correlação de material atribuído e evita subqueries RLS recursivas.

revoke all on function private.teacher_has_group(uuid) from public;
grant execute on function private.teacher_has_group(uuid) to authenticated;

create or replace function private.can_read_material(target_material uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.material_assignments ma
    where ma.material_id = target_material
      and (
        (
          ma.student_id is not null
          and (
            exists (
              select 1
              from public.students s
              where s.id = ma.student_id
                and s.deleted_at is null
                and s.auth_user_id = (select auth.uid())
            )
            or exists (
              select 1
              from public.guardian_students gs
              join public.guardians g on g.id = gs.guardian_id
              join public.students s on s.id = gs.student_id
              where gs.student_id = ma.student_id
                and g.profile_id = (select auth.uid())
                and g.active = true
                and s.deleted_at is null
            )
          )
        )
        or (
          ma.class_id is not null
          and exists (
            select 1
            from public.class_students cs
            join public.students s on s.id = cs.student_id
            where cs.class_id = ma.class_id
              and cs.active = true
              and s.deleted_at is null
              and (
                s.auth_user_id = (select auth.uid())
                or exists (
                  select 1
                  from public.guardian_students gs
                  join public.guardians g on g.id = gs.guardian_id
                  where gs.student_id = s.id
                    and g.profile_id = (select auth.uid())
                    and g.active = true
                )
              )
          )
        )
        or (
          ma.pedagogical_group_id is not null
          and exists (
            select 1
            from public.pedagogical_group_students pgs
            join public.students s on s.id = pgs.student_id
            where pgs.group_id = ma.pedagogical_group_id
              and s.deleted_at is null
              and (
                s.auth_user_id = (select auth.uid())
                or exists (
                  select 1
                  from public.guardian_students gs
                  join public.guardians g on g.id = gs.guardian_id
                  where gs.student_id = s.id
                    and g.profile_id = (select auth.uid())
                    and g.active = true
                )
              )
          )
        )
      )
  );
$$;

revoke all on function private.can_read_material(uuid) from public;
grant execute on function private.can_read_material(uuid) to authenticated;

drop policy if exists materials_select on public.materials;
create policy materials_select on public.materials
for select to authenticated
using (
  private.has_role('admin'::app_role)
  or private.has_role('teacher'::app_role)
  or private.can_read_material(id)
);
