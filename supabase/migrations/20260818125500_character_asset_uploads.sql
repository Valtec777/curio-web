-- Centralized mascot images used by the Plumareli character catalog.
-- Files are public because mascot artwork is displayed throughout the app,
-- while write operations remain restricted to authenticated administrators.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'character-assets',
  'character-assets',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists character_assets_admin_select on storage.objects;
create policy character_assets_admin_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'character-assets'
  and private.has_role('admin'::app_role)
);

drop policy if exists character_assets_admin_insert on storage.objects;
create policy character_assets_admin_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'character-assets'
  and private.has_role('admin'::app_role)
);

drop policy if exists character_assets_admin_update on storage.objects;
create policy character_assets_admin_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'character-assets'
  and private.has_role('admin'::app_role)
)
with check (
  bucket_id = 'character-assets'
  and private.has_role('admin'::app_role)
);

drop policy if exists character_assets_admin_delete on storage.objects;
create policy character_assets_admin_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'character-assets'
  and private.has_role('admin'::app_role)
);
