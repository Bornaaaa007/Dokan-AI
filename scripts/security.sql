-- Database security for Dokan AI. Safe to run more than once. Tell Person 2 first, then run it in the Supabase SQL Editor.
-- Do NOT re-run schema.sql or seed.sql: they would wipe the demo data.
-- Every server route and the stylist function use the SECRET key, which bypasses RLS, so none of them change.
-- Only the browser (public key) is affected, and the only thing it reads directly is the signed-in user's own row.

-- 1) Signup trigger: every new login gets its public.users row.
--    The role comes from the signup form but is checked here: only "customer" or "seller" is ever accepted, never "admin".
--    A seller signup keeps the customer role too, so the same person can still buy.
--    It never links to an existing row by email (that would let a stranger take over a seeded account such as an admin).
create or replace function public.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_name text := nullif(btrim(coalesce(new.raw_user_meta_data->>'name', '')), '');
  v_role text := lower(coalesce(new.raw_user_meta_data->>'role', 'customer'));
begin
  insert into public.users (auth_id, name, email, roles)
  values (
    new.id,
    left(coalesce(v_name, nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'New user'), 120),
    new.email,
    case when v_role = 'seller' then array['customer', 'seller'] else array['customer'] end
  )
  on conflict (auth_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Nobody but the database itself may call the trigger function.
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

-- 2) Backfill: people who already signed up before the trigger existed get their row now (customer role only).
insert into public.users (auth_id, name, email, roles)
select a.id,
       left(coalesce(nullif(btrim(a.raw_user_meta_data->>'name'), ''), nullif(split_part(coalesce(a.email, ''), '@', 1), ''), 'New user'), 120),
       a.email,
       case when lower(coalesce(a.raw_user_meta_data->>'role', '')) = 'seller' then array['customer', 'seller'] else array['customer'] end
from auth.users a
where not exists (select 1 from public.users u where u.auth_id = a.id);

-- 3) Row Level Security on every table. With no policy, the public key can neither read nor write a table.
alter table users            enable row level security;
alter table shops            enable row level security;
alter table products         enable row level security;
alter table orders           enable row level security;
alter table complaints       enable row level security;
alter table badges           enable row level security;
alter table search_logs      enable row level security;
alter table event_logs       enable row level security;
alter table ai_conversations enable row level security;

-- The one thing the browser reads directly: the signed-in person's own row (id, name, roles).
-- There is deliberately no update policy, so nobody can edit their own roles.
drop policy if exists users_read_own on users;
create policy users_read_own on users for select to authenticated using (auth_id = (select auth.uid()));

-- 4) The analytics views run with their owner's rights and would ignore RLS, so take them away from the public key.
revoke all on demand_gap, trending_products, product_performance, top_sellers from anon, authenticated;

-- 5) Check: every table should say true, and users should show exactly one policy.
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename;
select tablename, policyname, cmd from pg_policies where schemaname = 'public';
