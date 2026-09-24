insert into storage.buckets (id, name, public, allowed_mime_types)
values ('card-photos', 'card-photos', false, array['image/jpeg']);

create policy card_photos_owner_select on storage.objects for select to authenticated
using (bucket_id = 'card-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy card_photos_owner_insert on storage.objects for insert to authenticated
with check (bucket_id = 'card-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy card_photos_owner_update on storage.objects for update to authenticated
using (bucket_id = 'card-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'card-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy card_photos_owner_delete on storage.objects for delete to authenticated
using (bucket_id = 'card-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
