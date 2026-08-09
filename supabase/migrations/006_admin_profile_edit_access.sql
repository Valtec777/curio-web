-- Admin pode corrigir dados de perfil pela interface.
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
for update to authenticated
using (private.has_role('admin'::app_role))
with check (private.has_role('admin'::app_role));
