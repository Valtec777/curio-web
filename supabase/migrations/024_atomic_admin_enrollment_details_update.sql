-- CURIÓ · Edição administrativa atômica da matrícula
-- Atualiza registros existentes sem recriar aluno, responsável, matrícula ou vínculos.

create or replace function public.update_admin_enrollment_details(
  p_invitation_id uuid,
  p_student_full_name text,
  p_student_preferred_name text,
  p_grade_id uuid,
  p_school_name text,
  p_guardian_full_name text,
  p_guardian_preferred_name text,
  p_phone_whatsapp text,
  p_relationship text
)
returns uuid
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  v_invitation public.access_invitations%rowtype;
  v_guardian_id uuid;
begin
  if not private.has_role('admin'::app_role) then
    raise exception 'admin role required';
  end if;

  select * into v_invitation
  from public.access_invitations
  where id = p_invitation_id
    and role = 'guardian'
    and deleted_at is null
  for update;

  if not found or v_invitation.student_id is null or v_invitation.auth_user_id is null then
    raise exception 'enrollment is not ready for editing';
  end if;

  if nullif(trim(p_student_full_name), '') is null then
    raise exception 'student name required';
  end if;
  if nullif(trim(p_guardian_full_name), '') is null then
    raise exception 'guardian name required';
  end if;
  if nullif(trim(p_relationship), '') is null then
    raise exception 'relationship required';
  end if;

  if p_grade_id is not null and not exists (
    select 1 from public.grades g where g.id = p_grade_id and g.active = true
  ) then
    raise exception 'grade is not active';
  end if;

  select g.id into v_guardian_id
  from public.guardians g
  where g.profile_id = v_invitation.auth_user_id
  limit 1;

  if v_guardian_id is null then
    raise exception 'guardian profile not found';
  end if;

  update public.students
  set full_name = trim(p_student_full_name),
      preferred_name = coalesce(nullif(trim(p_student_preferred_name), ''), trim(p_student_full_name)),
      grade_id = p_grade_id,
      school_name = nullif(trim(p_school_name), ''),
      updated_at = now()
  where id = v_invitation.student_id
    and deleted_at is null;

  if not found then
    raise exception 'student is not operational';
  end if;

  update public.profiles
  set full_name = trim(p_guardian_full_name),
      preferred_name = nullif(trim(p_guardian_preferred_name), ''),
      phone_whatsapp = nullif(trim(p_phone_whatsapp), ''),
      updated_at = now()
  where id = v_invitation.auth_user_id;

  if not found then
    raise exception 'guardian profile not found';
  end if;

  insert into public.guardian_students(
    guardian_id, student_id, relationship, can_view_progress, can_manage_access
  ) values (
    v_guardian_id, v_invitation.student_id, trim(p_relationship), true, true
  )
  on conflict (guardian_id, student_id)
  do update set relationship = excluded.relationship;

  update public.access_invitations
  set full_name = trim(p_guardian_full_name),
      preferred_name = nullif(trim(p_guardian_preferred_name), ''),
      phone_whatsapp = nullif(trim(p_phone_whatsapp), ''),
      relationship = trim(p_relationship),
      updated_at = now(),
      last_error = null
  where id = v_invitation.id;

  return v_invitation.student_id;
end;
$$;

revoke all on function public.update_admin_enrollment_details(uuid,text,text,uuid,text,text,text,text,text) from public;
grant execute on function public.update_admin_enrollment_details(uuid,text,text,uuid,text,text,text,text,text) to authenticated;
