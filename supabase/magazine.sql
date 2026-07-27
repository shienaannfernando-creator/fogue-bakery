-- ============================================================
-- Fogue Bakery — Magazine issues
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run. Powers the flip-through viewers on book.html: each row
-- in magazine_issues points at its own PDF in the magazine-files bucket,
-- so any number of issues can be uploaded and shown side by side.
-- ============================================================

create table if not exists public.magazine_issues (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  pdf_path text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.magazine_issues enable row level security;

drop policy if exists "magazine issues public read"  on public.magazine_issues;
drop policy if exists "magazine issues auth insert"   on public.magazine_issues;
drop policy if exists "magazine issues auth update"   on public.magazine_issues;
drop policy if exists "magazine issues auth delete"   on public.magazine_issues;

create policy "magazine issues public read"
  on public.magazine_issues for select
  using (true);

create policy "magazine issues auth insert"
  on public.magazine_issues for insert
  to authenticated
  with check (true);

create policy "magazine issues auth update"
  on public.magazine_issues for update
  to authenticated
  using (true) with check (true);

create policy "magazine issues auth delete"
  on public.magazine_issues for delete
  to authenticated
  using (true);

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
