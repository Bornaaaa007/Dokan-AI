-- Run once in the Supabase SQL Editor. Creates the public photo bucket and lets each seller
-- upload only inside their own folder (folder name = their auth user id).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "sellers upload own photos" on storage.objects;
drop policy if exists "sellers change own photos" on storage.objects;
drop policy if exists "sellers delete own photos" on storage.objects;

create policy "sellers upload own photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "sellers change own photos" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "sellers delete own photos" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- check: should return one row, public = true
select id, public, file_size_limit from storage.buckets where id = 'product-images';
