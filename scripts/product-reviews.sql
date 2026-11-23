-- Run ONCE in the Supabase SQL Editor. Safe to re-run. Additive only: nothing existing changes.
-- Product reviews: a customer reviews a product from one of their DELIVERED orders.
-- One review per product per order. Public right away (the delivered order is the proof); an admin can hide it.
-- These are NOT platform reviews (home page) and NOT complaints.

create table if not exists public.product_reviews (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  order_id   uuid not null references public.orders(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  rating     smallint not null check (rating between 1 and 5),
  body       text not null check (char_length(body) between 10 and 500),
  status     text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.users(id),
  unique (order_id, product_id)
);

create index if not exists product_reviews_product_idx on public.product_reviews (product_id, status, created_at desc);
create index if not exists product_reviews_status_idx on public.product_reviews (status, created_at desc);

-- Same rule as the other tables: only the server (secret key) reads and writes.
alter table public.product_reviews enable row level security;
revoke all on public.product_reviews from anon, authenticated;

-- Rating count and average for one product, computed in the database so the page never loads every rating.
create or replace function public.product_review_summary(p_product uuid)
returns table (review_count bigint, average numeric)
language sql stable security definer set search_path = public as $$
  select count(*)::bigint, round(avg(rating)::numeric, 1)
  from product_reviews where product_id = p_product and status = 'visible';
$$;
revoke all on function public.product_review_summary(uuid) from public, anon, authenticated;

-- Index for the per-user daily limit.
create index if not exists product_reviews_user_idx on public.product_reviews (user_id, created_at desc);
