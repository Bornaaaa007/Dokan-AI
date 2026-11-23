-- Orders and sandbox payment: one column and five functions. Safe to run more than once. Tell Person 2 first.
-- Do NOT re-run schema.sql or seed.sql: they would wipe the demo data.

alter table orders add column if not exists delivery_address jsonb;
-- Ledger timestamps (PRD PAY-5). Orders paid before this change keep empty values here.
alter table orders add column if not exists paid_at timestamptz;
alter table orders add column if not exists released_at timestamptz;
alter table orders add column if not exists refunded_at timestamptz;

-- 1) Place an order: lock the products, check and lower stock, insert the order. All or nothing.
create or replace function place_order(
  p_customer uuid, p_shop uuid, p_items jsonb, p_item_total int, p_delivery int, p_method payment_method_t, p_address jsonb
) returns orders language plpgsql security definer set search_path = public as $$
declare it jsonb; prod products; idx int; o orders;
begin
  for it in select value from jsonb_array_elements(p_items) loop
    select * into prod from products
      where id = (it->>'product_id')::uuid and shop_id = p_shop and status = 'active' for update;
    if not found then raise exception 'product_unavailable'; end if;
    idx := null;
    select (t.ord - 1)::int into idx from jsonb_array_elements(prod.variants) with ordinality as t(val, ord)
      where lower(t.val->>'size') = lower(it->>'size')
        and lower(coalesce(t.val->>'color', '')) = lower(coalesce(it->>'color', ''))
      limit 1;
    if idx is null then raise exception 'variant_unavailable'; end if;
    if coalesce((prod.variants->idx->>'stock')::int, 0) < (it->>'qty')::int then raise exception 'out_of_stock'; end if;
    update products
       set variants = jsonb_set(variants, array[idx::text, 'stock'], to_jsonb((variants->idx->>'stock')::int - (it->>'qty')::int))
     where id = prod.id;
  end loop;
  insert into orders (customer_id, shop_id, items, item_total, delivery_charge, payment_method, delivery_address)
  values (p_customer, p_shop, p_items, p_item_total, p_delivery, p_method, p_address)
  returning * into o;
  return o;
end $$;

-- 2) Cancel: put the stock back and refund money that is held. All or nothing.
create or replace function cancel_order(p_order uuid) returns orders language plpgsql security definer set search_path = public as $$
declare o orders; it jsonb; prod products; idx int;
begin
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.status = 'cancelled' then raise exception 'already_cancelled'; end if;
  if o.status not in ('placed', 'accepted', 'packed') then raise exception 'cannot_cancel'; end if;
  for it in select value from jsonb_array_elements(o.items) loop
    select * into prod from products where id = (it->>'product_id')::uuid for update;
    if found then
      idx := null;
      select (t.ord - 1)::int into idx from jsonb_array_elements(prod.variants) with ordinality as t(val, ord)
        where lower(t.val->>'size') = lower(it->>'size')
          and lower(coalesce(t.val->>'color', '')) = lower(coalesce(it->>'color', ''))
        limit 1;
      if idx is not null then
        update products
           set variants = jsonb_set(variants, array[idx::text, 'stock'], to_jsonb((variants->idx->>'stock')::int + (it->>'qty')::int))
         where id = prod.id;
      end if;
    end if;
  end loop;
  update orders set status = 'cancelled',
         refunded_at = case when payment_status = 'held' then now() else refunded_at end,
         payment_status = case when payment_status = 'held' then 'refunded'::payment_status_t else payment_status end
   where id = p_order returning * into o;
  return o;
end $$;

-- 3) Release escrow for one delivered order. Skipped while any complaint is open or upheld.
create or replace function release_order(p_order uuid) returns boolean language plpgsql security definer set search_path = public as $$
begin
  update orders set payment_status = 'released', released_at = now()
   where id = p_order and payment_status = 'held' and status = 'delivered'
     and not exists (select 1 from complaints c where c.order_id = orders.id and c.status in ('submitted', 'responded', 'appealed', 'upheld'));
  return found;
end $$;

-- 4) Release every delivered order whose 48 hours have passed. Returns the ids it released.
create or replace function release_due_orders(p_cutoff timestamptz) returns setof uuid language plpgsql security definer set search_path = public as $$
begin
  return query
    with r as (
      update orders set payment_status = 'released', released_at = now()
       where payment_status = 'held' and status = 'delivered' and delivered_at <= p_cutoff
         and not exists (select 1 from complaints c where c.order_id = orders.id and c.status in ('submitted', 'responded', 'appealed', 'upheld'))
      returning id)
    select id from r;
end $$;

-- 5) Full refund of money still held.
create or replace function refund_order(p_order uuid) returns boolean language plpgsql security definer set search_path = public as $$
begin
  update orders set payment_status = 'refunded', refunded_at = now() where id = p_order and payment_status = 'held';
  return found;
end $$;

-- These move money and stock, so only the server (secret key) may call them, never the public key.
revoke all on function place_order(uuid, uuid, jsonb, int, int, payment_method_t, jsonb) from public, anon, authenticated;
revoke all on function cancel_order(uuid) from public, anon, authenticated;
revoke all on function release_order(uuid) from public, anon, authenticated;
revoke all on function release_due_orders(timestamptz) from public, anon, authenticated;
revoke all on function refund_order(uuid) from public, anon, authenticated;
