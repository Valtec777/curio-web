-- CURIÓ · a edição da matrícula passa a atualizar também os dados complementares
-- já usados na criação, sem recriar aluno/responsável/vínculos.

drop function if exists public.update_admin_enrollment_details(uuid,text,text,uuid,text,text,text,text,text);

create function public.update_admin_enrollment_details(
  p_invitation_id uuid,
  p_student_full_name text,
  p_student_preferred_name text,
  p_grade_id uuid,
  p_school_name text,
  p_guardian_full_name text,
  p_guardian_preferred_name text,
  p_phone_whatsapp text,
  p_relationship text,
  p_birth_date date default null,
  p_child_cpf text default null,
  p_subjects text[] default '{}'::text[],
  p_pedagogical_notes text default null,
  p_guardian_cpf text default null,
  p_guardian_address text default null
)
returns uuid
language plpgsql
set search_path = public, private, pg_temp
as $$
declare
  v_invitation public.access_invitations%rowtype;
  v_guardian_id uuid;
begin
  if not private.has_role('admin'::app_role) then raise exception 'admin role required'; end if;

  select * into v_invitation
  from public.access_invitations
  where id = p_invitation_id and role = 'guardian' and deleted_at is null
  for update;

  if not found or v_invitation.student_id is null or v_invitation.auth_user_id is null then raise exception 'enrollment is not ready for editing'; end if;
  if nullif(trim(p_student_full_name), '') is null then raise exception 'student name required'; end if;
  if nullif(trim(p_guardian_full_name), '') is null then raise exception 'guardian name required'; end if;
  if nullif(trim(p_relationship), '') is null then raise exception 'relationship required'; end if;

  if p_grade_id is not null and not exists (select 1 from public.grades g where g.id=p_grade_id and g.active=true) then raise exception 'grade is not active'; end if;
  if cardinality(coalesce(p_subjects,'{}'::text[])) > 20 then raise exception 'too many subjects'; end if;

  select g.id into v_guardian_id from public.guardians g where g.profile_id=v_invitation.auth_user_id and g.active=true limit 1;
  if v_guardian_id is null then raise exception 'guardian profile not found'; end if;

  update public.students
  set full_name=trim(p_student_full_name),
      preferred_name=coalesce(nullif(trim(p_student_preferred_name),''),trim(p_student_full_name)),
      grade_id=p_grade_id,
      school_name=nullif(trim(p_school_name),''),
      updated_at=now()
  where id=v_invitation.student_id and deleted_at is null;
  if not found then raise exception 'student is not operational'; end if;

  update public.profiles
  set full_name=trim(p_guardian_full_name),
      preferred_name=nullif(trim(p_guardian_preferred_name),''),
      phone_whatsapp=nullif(trim(p_phone_whatsapp),''),
      updated_at=now()
  where id=v_invitation.auth_user_id;
  if not found then raise exception 'guardian profile not found'; end if;

  insert into public.guardian_students(guardian_id,student_id,relationship,can_view_progress,can_manage_access)
  values(v_guardian_id,v_invitation.student_id,trim(p_relationship),true,true)
  on conflict(guardian_id,student_id) do update set relationship=excluded.relationship;

  insert into public.student_private_details(student_id,birth_date,cpf,updated_at)
  values(v_invitation.student_id,p_birth_date,nullif(trim(p_child_cpf),''),now())
  on conflict(student_id) do update set birth_date=excluded.birth_date,cpf=excluded.cpf,updated_at=now();

  insert into public.student_learning_profiles(student_id,tracked_subjects,pedagogical_notes,updated_at)
  values(v_invitation.student_id,coalesce(p_subjects,'{}'::text[]),nullif(trim(p_pedagogical_notes),''),now())
  on conflict(student_id) do update set tracked_subjects=excluded.tracked_subjects,pedagogical_notes=excluded.pedagogical_notes,updated_at=now();

  insert into public.guardian_private_details(guardian_id,cpf,address,updated_at)
  values(v_guardian_id,nullif(trim(p_guardian_cpf),''),nullif(trim(p_guardian_address),''),now())
  on conflict(guardian_id) do update set cpf=excluded.cpf,address=excluded.address,updated_at=now();

  update public.access_invitations
  set full_name=trim(p_guardian_full_name),preferred_name=nullif(trim(p_guardian_preferred_name),''),phone_whatsapp=nullif(trim(p_phone_whatsapp),''),relationship=trim(p_relationship),updated_at=now(),last_error=null
  where id=v_invitation.id;

  return v_invitation.student_id;
end;
$$;

revoke all on function public.update_admin_enrollment_details(uuid,text,text,uuid,text,text,text,text,text,date,text,text[],text,text,text) from public, anon;
grant execute on function public.update_admin_enrollment_details(uuid,text,text,uuid,text,text,text,text,text,date,text,text[],text,text,text) to authenticated;
