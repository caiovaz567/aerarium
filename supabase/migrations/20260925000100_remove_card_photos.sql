-- Card photos were removed at the user's request after phase 8.
-- Removes the private bucket, its policies and the cards.photo_path column.

-- Never orphan files: the bucket must already be empty (checked on 2026-09-25).
do $$ begin
  if exists (select 1 from storage.objects where bucket_id = 'card-photos') then
    raise exception 'O bucket card-photos ainda tem arquivos. Remova pela API do Storage antes.';
  end if;
end $$;

drop policy if exists card_photos_owner_select on storage.objects;
drop policy if exists card_photos_owner_insert on storage.objects;
drop policy if exists card_photos_owner_update on storage.objects;
drop policy if exists card_photos_owner_delete on storage.objects;

-- Supabase blocks direct deletes on storage tables unless this is set for the
-- transaction; safe here because the bucket was just checked to be empty.
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.buckets where id = 'card-photos';

alter table public.cards drop column photo_path;
