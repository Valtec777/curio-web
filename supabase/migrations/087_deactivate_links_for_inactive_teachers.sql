create or replace function private.deactivate_teacher_student_links_when_teacher_inactive()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if old.active is distinct from new.active and new.active = false then
    update public.teacher_students
    set active = false
    where teacher_id = new.id and active = true;
  end if;
  return new;
end;
$$;

revoke all on function private.deactivate_teacher_student_links_when_teacher_inactive() from public;

drop trigger if exists trg_deactivate_teacher_student_links_when_teacher_inactive on public.teachers;
create trigger trg_deactivate_teacher_student_links_when_teacher_inactive
after update of active on public.teachers
for each row execute function private.deactivate_teacher_student_links_when_teacher_inactive();

update public.teacher_students ts
set active = false
from public.teachers t
where t.id = ts.teacher_id
  and t.active = false
  and ts.active = true;

create or replace function public.guardian_child_overview()
returns table(
  student_id uuid,
  student_name text,
  full_name text,
  school_name text,
  student_status text,
  grade_name text,
  relationship text,
  can_view_progress boolean,
  teacher_id uuid,
  teacher_user_id uuid,
  teacher_name text,
  tracked_subjects text[]
)
language sql
stable security definer
set search_path = public, private, pg_temp
as $$
  select s.id,
         coalesce(s.preferred_name, s.full_name, 'Criança'),
         s.full_name,
         s.school_name,
         s.status::text,
         gr.name,
         coalesce(gs.relationship, 'Responsável'),
         gs.can_view_progress,
         t.id,
         t.profile_id,
         coalesce(tp.preferred_name, tp.full_name, 'Professor(a)'),
         coalesce(slp.tracked_subjects, '{}'::text[])
  from public.guardians g
  join public.guardian_students gs on gs.guardian_id = g.id
  join public.students s on s.id = gs.student_id and s.deleted_at is null
  left join public.grades gr on gr.id = s.grade_id
  left join public.student_learning_profiles slp on slp.student_id = s.id
  left join lateral (
    select ts.teacher_id
    from public.teacher_students ts
    join public.teachers linked_teacher on linked_teacher.id = ts.teacher_id and linked_teacher.active = true
    where ts.student_id = s.id and ts.active = true
    order by ts.created_at desc
    limit 1
  ) ts on true
  left join public.teachers t on t.id = ts.teacher_id and t.active = true
  left join public.profiles tp on tp.id = t.profile_id
  where g.profile_id = (select auth.uid())
    and g.active = true
    and private.has_role('guardian'::public.app_role)
  order by s.preferred_name, s.full_name;
$$;

revoke all on function public.guardian_child_overview() from public;
grant execute on function public.guardian_child_overview() to authenticated;
