-- CURIÓ · Alunos excluídos deixam a operação, mas permanecem disponíveis ao Admin para restauração/histórico.

create or replace function private.teacher_has_student(target_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.teacher_students ts
    join public.teachers t on t.id = ts.teacher_id
    join public.students s on s.id = ts.student_id
    where t.profile_id = (select auth.uid())
      and ts.student_id = target_student
      and ts.active = true
      and t.active = true
      and s.deleted_at is null
  );
$$;

create or replace function private.guardian_has_student(target_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.guardian_students gs
    join public.guardians g on g.id = gs.guardian_id
    join public.students s on s.id = gs.student_id
    where g.profile_id = (select auth.uid())
      and gs.student_id = target_student
      and s.deleted_at is null
  );
$$;

drop policy if exists students_select on public.students;
create policy students_select on public.students
for select to authenticated
using (
  private.has_role('admin'::app_role)
  or (
    deleted_at is null
    and (
      auth_user_id = (select auth.uid())
      or private.teacher_has_student(id)
      or private.guardian_has_student(id)
    )
  )
);

drop policy if exists teacher_students_select on public.teacher_students;
create policy teacher_students_select on public.teacher_students
for select to authenticated
using (
  private.has_role('admin'::app_role)
  or exists (
    select 1 from public.students s
    where s.id = teacher_students.student_id
      and s.deleted_at is null
      and (
        teacher_students.teacher_id = private.teacher_id_for_user()
        or s.auth_user_id = (select auth.uid())
      )
  )
);

drop policy if exists guardian_students_select on public.guardian_students;
create policy guardian_students_select on public.guardian_students
for select to authenticated
using (
  private.has_role('admin'::app_role)
  or exists (
    select 1 from public.students s
    where s.id = guardian_students.student_id
      and s.deleted_at is null
      and (
        guardian_students.guardian_id = private.guardian_id_for_user()
        or s.auth_user_id = (select auth.uid())
      )
  )
);
