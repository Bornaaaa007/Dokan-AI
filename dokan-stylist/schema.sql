-- ============================================================
-- Dokan AI - Supabase / Postgres schema
-- Matches section 12 (Shared Data Schema) of the requirements doc.
-- No generated columns: commission, badge expiry and stock logic live in code.
-- Run the whole script in Supabase > SQL Editor.
-- WARNING: the first block DROPS the tables below. Safe on a fresh project,
-- but it deletes data if you run it again later.
-- ============================================================

-- ---------- 0. Reset (safe to re-run during setup) ----------
drop table if exists ai_conversations cascade;
drop table if exists event_logs cascade;
drop table if exists search_logs cascade;
drop table if exists badges cascade;
drop table if exists complaints cascade;
drop table if exists orders cascade;
drop table if exists products cascade;
drop table if exists shops cascade;
drop table if exists users cascade;

drop type if exists gender_t cascade;
drop type if exists age_group_t cascade;
drop type if exists category_t cascade;
drop type if exists plan_t cascade;
drop type if exists verification_status_t cascade;
drop type if exists product_status_t cascade;
drop type if exists order_status_t cascade;
drop type if exists payment_method_t cascade;
drop type if exists payment_status_t cascade;
drop type if exists complaint_status_t cascade;
drop type if exists party_role_t cascade;
drop type if exists badge_status_t cascade;
drop type if exists event_type_t cascade;

-- ---------- 1. Enums (exact lowercase values from section 12.3) ----------
create type gender_t as enum ('female', 'male', 'unisex');
create type age_group_t as enum ('child', 'adult', 'elderly');
create type category_t as enum ('clothing', 'jewelry', 'shoes', 'accessories');
create type plan_t as enum ('free', 'premium');
create type verification_status_t as enum ('pending', 'verified', 'rejected');
create type product_status_t as enum ('active', 'hidden');
create type order_status_t as enum ('placed', 'accepted', 'packed', 'shipped', 'delivered', 'cancelled');
create type payment_method_t as enum ('sandbox', 'cod');
create type payment_status_t as enum ('pending', 'paid', 'held', 'released', 'refunded', 'failed');
create type complaint_status_t as enum ('submitted', 'responded', 'upheld', 'rejected', 'appealed');
create type party_role_t as enum ('customer', 'seller');
create type badge_status_t as enum ('active', 'expired', 'removed');
create type event_type_t as enum ('view', 'add_to_cart', 'purchase');

-- ---------- 2. Users ----------
-- auth_id links to Supabase Auth. It is nullable so you can seed fake users
-- for testing without creating real logins.
create table users (
  id         uuid primary key default gen_random_uuid(),
  auth_id    uuid unique references auth.users(id) on delete set null,
  name       text not null,
  phone      text,
  email      text,
  roles      text[] not null default array['customer'],
  gender     gender_t,
  age_group  age_group_t,
  created_at timestamptz not null default now(),
  constraint users_roles_valid check (roles <@ array['customer', 'seller', 'admin'])
);

-- ---------- 3. Shops ----------
create table shops (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references users(id) on delete cascade,
  name                text not null,
  description         text,
  city                text,
  social_url          text,
  nid_number          text,                       -- admin only: never return to clients
  verification_status verification_status_t not null default 'pending',
  plan                plan_t not null default 'free',
  plan_expires_at     timestamptz,
  return_policy       text,
  created_at          timestamptz not null default now()
);

-- ---------- 4. Products ----------
-- variants: [{ "size": "M", "color": "maroon", "stock": 3 }, ...]
-- In stock = any variant with stock > 0 (checked in code / queries).
create table products (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references shops(id) on delete cascade,
  name            text not null,
  description     text,
  category        category_t not null,
  custom_category text,                           -- e.g. 'three-piece', 'kurti', 'sari'
  gender          gender_t not null,
  age_group       age_group_t not null,
  colors          text[] not null default '{}',   -- lowercase, e.g. 'maroon'
  occasion_tags   text[] not null default '{}',   -- wedding, formal, eid, casual, party
  image_urls      text[] not null default '{}',
  price           integer not null check (price >= 0),
  discount_price  integer check (discount_price is null or discount_price >= 0),
  variants        jsonb not null default '[]'::jsonb,
  status          product_status_t not null default 'active',
  created_at      timestamptz not null default now(),
  constraint products_discount_lower check (discount_price is null or discount_price <= price)
);

-- ---------- 5. Orders ----------
-- items: [{ "product_id": "...", "size": "M", "color": "maroon", "qty": 1, "unit_price": 2500 }]
-- commission_rate is 0.02, 0.03 or 0.05 (set by backend when paid).
create table orders (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references users(id),
  shop_id           uuid not null references shops(id),
  items             jsonb not null default '[]'::jsonb,
  item_total        integer not null check (item_total >= 0),
  delivery_charge   integer not null default 0 check (delivery_charge >= 0),
  commission_rate   numeric(4,2) not null default 0,
  commission_amount integer not null default 0 check (commission_amount >= 0),
  payment_method    payment_method_t not null default 'sandbox',
  payment_status    payment_status_t not null default 'pending',
  status            order_status_t not null default 'placed',
  placed_at         timestamptz not null default now(),
  delivered_at      timestamptz
);

-- ---------- 6. Complaints ----------
create table complaints (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  filed_by        uuid not null references users(id),
  accused_id      uuid not null references users(id),
  filed_by_role   party_role_t not null,
  accused_role    party_role_t not null,
  reason_code     text not null,
  description     text,
  evidence_urls   text[] not null default '{}',
  response_text   text,
  status          complaint_status_t not null default 'submitted',
  decision_note   text,
  decided_by      uuid references users(id),
  created_at      timestamptz not null default now(),
  decided_at      timestamptz,
  constraint complaints_reason_valid check (
    reason_code in ('not_delivered', 'not_as_described', 'wrong_size', 'refused_delivery', 'false_claim', 'other')
  ),
  constraint complaints_different_parties check (filed_by <> accused_id),
  constraint complaints_one_per_order_per_filer unique (order_id, filed_by),
  -- a decision always needs a written reason
  constraint complaints_decision_needs_note check (
    status not in ('upheld', 'rejected') or (decision_note is not null and length(trim(decision_note)) > 0)
  )
);

-- ---------- 7. Badges ----------
-- expires_at is set by code: issued_at + 6 months (seller) or + 3 months (customer).
create table badges (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references users(id) on delete cascade,
  role                 party_role_t not null,
  source_complaint_id  uuid references complaints(id) on delete set null,
  status               badge_status_t not null default 'active',
  issued_at            timestamptz not null default now(),
  expires_at           timestamptz not null,
  constraint badges_expiry_after_issue check (expires_at > issued_at)
);

-- ---------- 8. Logs for analytics ----------
create table search_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references users(id) on delete set null,
  query        text,
  filters      jsonb not null default '{}'::jsonb,
  result_count integer not null default 0,
  created_at   timestamptz not null default now()
);

create table event_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id) on delete set null,
  product_id  uuid references products(id) on delete cascade,
  shop_id     uuid references shops(id) on delete cascade,
  type        event_type_t not null,
  created_at  timestamptz not null default now()
);

-- ---------- 9. AI stylist conversations ----------
-- messages: [{ "role": "user" | "assistant", "text": "...", "created_at": "..." }]
-- bundle:   { "items": [product ids], "total": 4800 }
create table ai_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id) on delete set null,
  messages    jsonb not null default '[]'::jsonb,
  budget      integer,
  bundle      jsonb,
  created_at  timestamptz not null default now()
);

-- ---------- 10. Indexes for search and analytics ----------
create index idx_shops_owner           on shops(owner_id);
create index idx_products_shop         on products(shop_id);
create index idx_products_category     on products(category);
create index idx_products_gender_age   on products(gender, age_group);
create index idx_products_price        on products(price);
create index idx_products_status       on products(status);
create index idx_products_colors       on products using gin (colors);
create index idx_products_occasions    on products using gin (occasion_tags);
create index idx_orders_customer       on orders(customer_id);
create index idx_orders_shop           on orders(shop_id);
create index idx_orders_status         on orders(status);
create index idx_orders_placed_at      on orders(placed_at);
create index idx_complaints_order      on complaints(order_id);
create index idx_complaints_accused    on complaints(accused_id);
create index idx_complaints_status     on complaints(status);
create index idx_badges_user_status    on badges(user_id, status);
create index idx_search_logs_created   on search_logs(created_at);
create index idx_event_logs_product    on event_logs(product_id, type);
create index idx_event_logs_created    on event_logs(created_at);
create index idx_ai_conv_user          on ai_conversations(user_id);

-- ============================================================
-- OPTIONAL: Row Level Security.
-- Tables made with SQL do NOT have RLS turned on, so anyone with the public
-- (anon) key can read and write them. Fine for early development, but turn
-- this on before you share the project key anywhere public.
-- Your Edge Function uses the service-role key, which bypasses RLS.
-- Uncomment to enable:
--
-- alter table users enable row level security;
-- alter table shops enable row level security;
-- alter table products enable row level security;
-- alter table orders enable row level security;
-- alter table complaints enable row level security;
-- alter table badges enable row level security;
-- alter table search_logs enable row level security;
-- alter table event_logs enable row level security;
-- alter table ai_conversations enable row level security;
--
-- create policy "public can read active products" on products
--   for select using (status = 'active');
-- create policy "public can read shops" on shops
--   for select using (true);
-- ============================================================
