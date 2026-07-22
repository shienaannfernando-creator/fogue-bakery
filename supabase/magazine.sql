-- ============================================================
-- Fogue Bakery — Magazine PDF storage
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run. Powers the flip-through viewer on book.html: the
-- dashboard uploads a single PDF to a fixed path (magazine-files/current.pdf),
-- overwriting it each time — no table needed, just a bucket + policies.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('magazine-files', 'magazine-files', true)
on conflict (id) do update set public = true;

drop policy if exists "magazine files public read"  on storage.objects;
drop policy if exists "magazine files auth insert"   on storage.objects;
drop policy if exists "magazine files auth update"   on storage.objects;
drop policy if exists "magazine files auth delete"   on storage.objects;

create policy "magazine files public read"
  on storage.objects for select
  using (bucket_id = 'magazine-files');

create policy "magazine files auth insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'magazine-files');

create policy "magazine files auth update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'magazine-files') with check (bucket_id = 'magazine-files');

create policy "magazine files auth delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'magazine-files');
