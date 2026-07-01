-- ============================================================
-- Fogue Bakery — Blog articles
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run. Requires schema.sql to have been run first (for pgcrypto
-- and the set_updated_at() function).
-- ============================================================

create extension if not exists "pgcrypto";

-- fallback in case schema.sql wasn't run: make sure the timestamp helper exists
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- articles table ----------
create table if not exists public.articles (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,               -- used in article.html?id=<slug>
  title        text not null,
  image        text,                               -- cover image (public URL)
  excerpt      text,                               -- short blurb on the blog list
  body         text,                               -- full article, blank lines = paragraphs
  published    boolean not null default true,      -- hide drafts from the public site
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists articles_created_idx on public.articles (created_at desc);
create index if not exists articles_published_idx on public.articles (published, created_at desc);

drop trigger if exists articles_set_updated_at on public.articles;
create trigger articles_set_updated_at
  before update on public.articles
  for each row execute function public.set_updated_at();

-- ---------- row level security ----------
--   Public may read ONLY published articles; admins may do everything.
alter table public.articles enable row level security;

drop policy if exists "articles public read"  on public.articles;
drop policy if exists "articles auth read"     on public.articles;
drop policy if exists "articles auth insert"   on public.articles;
drop policy if exists "articles auth update"   on public.articles;
drop policy if exists "articles auth delete"   on public.articles;

create policy "articles public read"
  on public.articles for select
  using (published = true);

-- authenticated admins can also see drafts
create policy "articles auth read"
  on public.articles for select
  to authenticated
  using (true);

create policy "articles auth insert"
  on public.articles for insert
  to authenticated
  with check (true);

create policy "articles auth update"
  on public.articles for update
  to authenticated
  using (true) with check (true);

create policy "articles auth delete"
  on public.articles for delete
  to authenticated
  using (true);

-- ---------- storage bucket for article cover images ----------
insert into storage.buckets (id, name, public)
values ('article-images', 'article-images', true)
on conflict (id) do update set public = true;

drop policy if exists "article images public read"  on storage.objects;
drop policy if exists "article images auth insert"   on storage.objects;
drop policy if exists "article images auth update"   on storage.objects;
drop policy if exists "article images auth delete"   on storage.objects;

create policy "article images public read"
  on storage.objects for select
  using (bucket_id = 'article-images');

create policy "article images auth insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'article-images');

create policy "article images auth update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'article-images') with check (bucket_id = 'article-images');

create policy "article images auth delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'article-images');
