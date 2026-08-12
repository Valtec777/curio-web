-- CURIÓ · endurecimento da Central de Indicações.
alter function private.referral_program_is_active(public.referral_program_settings) set search_path = public,private,pg_temp;
revoke execute on function public.admin_link_referral_enrollment(uuid,uuid,uuid,uuid) from authenticated;
