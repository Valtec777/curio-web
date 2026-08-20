-- Do not grant an application role merely because an Auth user exists.
-- Roles are assigned only from a valid, non-deleted access invitation.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_inv public.access_invitations%rowtype;
  v_role public.app_role;
  v_full_name text;
  v_preferred_name text;
  v_phone text;
begin
  select * into v_inv
  from public.access_invitations
  where lower(email::text) = lower(coalesce(new.email,''))
    and status in ('pending','sent')
    and deleted_at is null
  order by created_at desc
  limit 1;

  if found then
    v_role := v_inv.role;
    v_full_name := coalesce(nullif(v_inv.full_name,''), new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email,''), '@', 1));
    v_preferred_name := coalesce(nullif(v_inv.preferred_name,''), new.raw_user_meta_data->>'preferred_name', v_full_name);
    v_phone := v_inv.phone_whatsapp;
  else
    v_role := null;
    v_full_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email,''), '@', 1));
    v_preferred_name := coalesce(new.raw_user_meta_data->>'preferred_name', new.raw_user_meta_data->>'full_name', v_full_name);
    v_phone := new.raw_user_meta_data->>'phone_whatsapp';
  end if;

  insert into public.profiles(id, full_name, preferred_name, phone_whatsapp)
  values (new.id, v_full_name, v_preferred_name, v_phone)
  on conflict (id) do update set
    full_name = excluded.full_name,
    preferred_name = coalesce(excluded.preferred_name, public.profiles.preferred_name),
    phone_whatsapp = coalesce(excluded.phone_whatsapp, public.profiles.phone_whatsapp),
    updated_at = now();

  if v_role is not null then
    insert into public.user_roles(user_id, role)
    values (new.id, v_role)
    on conflict do nothing;

    if v_role = 'guardian'::public.app_role then
      insert into public.guardians(profile_id)
      values (new.id)
      on conflict (profile_id) do nothing;
    elsif v_role = 'teacher'::public.app_role then
      insert into public.teachers(profile_id, phone_whatsapp, active)
      values (new.id, v_phone, true)
      on conflict (profile_id) do update set
        phone_whatsapp = coalesce(excluded.phone_whatsapp, public.teachers.phone_whatsapp),
        active = true;
    end if;
  end if;

  if v_inv.id is not null then
    update public.access_invitations
       set auth_user_id = new.id,
           status = 'sent',
           sent_at = coalesce(sent_at, now()),
           updated_at = now(),
           last_error = null
     where id = v_inv.id;
  end if;

  return new;
end;
$function$;
