-- CURIÓ · Responsáveis vinculados visíveis ao Professor somente no escopo dos próprios alunos.
-- Retorna apenas nome e vínculo; não amplia leitura geral de profiles/guardians.

create or replace function public.teacher_linked_guardian_names()
returns table(student_id uuid, guardian_id uuid, guardian_name text, relationship text)
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select gs.student_id,
         g.id as guardian_id,
         coalesce(p.preferred_name,p.full_name,'Responsável') as guardian_name,
         coalesce(gs.relationship,'Responsável') as relationship
  from public.teacher_students ts
  join public.teachers t on t.id=ts.teacher_id
  join public.students s on s.id=ts.student_id
  join public.guardian_students gs on gs.student_id=ts.student_id
  join public.guardians g on g.id=gs.guardian_id and g.active=true
  join public.profiles p on p.id=g.profile_id
  where ts.active=true
    and t.active=true
    and s.deleted_at is null
    and t.profile_id=(select auth.uid())
    and private.has_role('teacher'::app_role);
$$;

revoke all on function public.teacher_linked_guardian_names() from public;
grant execute on function public.teacher_linked_guardian_names() to authenticated;
