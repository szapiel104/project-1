-- Zapisy gry w chmurze (2.11.2026, Michał: „żeby zapisy nie kasowały się z przeglądarką i nie zapychały bazy”).
-- Pliki leżą w Supabase Storage (osobny limit 1 GB w darmowym planie), nie w tabelach bazy (500 MB).
-- Każdy gracz ma swój folder `<user_id>/`: pliki zapisów `<id>.p1save` (spakowany JSON, zwykle kilka–kilkadziesiąt KB)
-- i spis `index.json` (opisy i miniatury). Czytać i pisać może tylko właściciel folderu. Plik do 2 MB.

insert into storage.buckets (id, name, public, file_size_limit)
values ('saves', 'saves', false, 2097152)
on conflict (id) do update set public = false, file_size_limit = 2097152;

drop policy if exists "zapisy: czytam swoje" on storage.objects;
drop policy if exists "zapisy: dodaję swoje" on storage.objects;
drop policy if exists "zapisy: zmieniam swoje" on storage.objects;
drop policy if exists "zapisy: usuwam swoje" on storage.objects;
create policy "zapisy: czytam swoje" on storage.objects for select to authenticated
  using (bucket_id = 'saves' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "zapisy: dodaję swoje" on storage.objects for insert to authenticated
  with check (bucket_id = 'saves' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "zapisy: zmieniam swoje" on storage.objects for update to authenticated
  using (bucket_id = 'saves' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'saves' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "zapisy: usuwam swoje" on storage.objects for delete to authenticated
  using (bucket_id = 'saves' and (storage.foldername(name))[1] = auth.uid()::text);
