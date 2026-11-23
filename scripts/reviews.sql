-- Run ONCE in the Supabase SQL Editor. Safe to re-run. Additive only: nothing existing changes.
-- Platform reviews: what shoppers and sellers say about Dokan AI itself (shown on the home page).
-- These are NOT product reviews and NOT complaints. A review shows publicly only after an admin approves it.

create table if not exists public.platform_reviews (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references public.users(id) on delete cascade,  -- one review per user
  rating     smallint not null check (rating between 1 and 5),
  body       text not null check (char_length(body) between 10 and 500),
  status     text not null default 'pending' check (status in ('pending', 'approved', 'hidden')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.users(id)
);

create index if not exists platform_reviews_status_created_idx on public.platform_reviews (status, created_at desc);

-- Same rule as the other tables: only the server (secret key) reads and writes.
alter table public.platform_reviews enable row level security;
revoke all on public.platform_reviews from anon, authenticated;
