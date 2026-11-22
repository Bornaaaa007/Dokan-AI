-- ============================================================
-- Demo complaints for the admin queue: 1 pending, 1 upheld, 1 rejected.
-- Creates 3 demo orders (the complaints need real orders) plus the 3 complaints.
-- No badges are created (badges are switched off for now).
-- Every demo complaint description starts with [DEMO]. Remove them all with scripts/remove-demo-complaints.sql
-- Refuses to run twice.
-- ============================================================
do $$
declare
  v_cust  uuid := (select id from users where name = 'Test Customer');
  v_admin uuid := (select id from users where name = 'Test Admin');
  v_shop_a uuid := (select id from shops where name = 'Rongdhonu Collection');
  v_shop_b uuid := (select id from shops where name = 'New Trend Fashion');
  v_shop_c uuid := (select id from shops where name = 'Step Up Footwear');
  v_own_a uuid; v_own_b uuid; v_own_c uuid;
  v_o_a uuid; v_o_b uuid; v_o_c uuid;
begin
  if v_cust is null or v_admin is null or v_shop_a is null or v_shop_b is null or v_shop_c is null then
    raise exception 'Expected seed users or shops are missing (Test Customer, Test Admin, three shops).';
  end if;
  if exists (select 1 from complaints where description like '[DEMO]%') then
    raise exception 'Demo complaints already exist. Run remove-demo-complaints.sql first.';
  end if;
  select owner_id into v_own_a from shops where id = v_shop_a;
  select owner_id into v_own_b from shops where id = v_shop_b;
  select owner_id into v_own_c from shops where id = v_shop_c;

  -- three delivered demo orders; each uses a real in-stock product from the shop when it has one
  create temp table demo_orders on commit drop as
  select s.shop_id, p.id as product_id, coalesce(coalesce(p.discount_price, p.price), 1200) as price
  from (values (v_shop_a), (v_shop_b), (v_shop_c)) s(shop_id)
  left join lateral (select * from products
                     where shop_id = s.shop_id and status = 'active'
                       and jsonb_path_exists(variants, '$[*] ? (@.stock > 0)')
                     order by price limit 1) p on true;

  insert into orders (customer_id, shop_id, items, item_total, delivery_charge, commission_rate, commission_amount,
                      payment_method, payment_status, status, placed_at, delivered_at)
  select v_cust, d.shop_id,
         case when d.product_id is null then '[]'::jsonb
              else jsonb_build_array(jsonb_build_object('product_id', d.product_id, 'size', 'free', 'color', 'n/a', 'qty', 1, 'unit_price', d.price)) end,
         d.price, 80,
         case when d.price < 500 then 2 when d.price < 1000 then 3 else 5 end,
         round(d.price * case when d.price < 500 then 0.02 when d.price < 1000 then 0.03 else 0.05 end),
         'sandbox', 'held', 'delivered', now() - interval '6 days', now() - interval '4 days'
  from demo_orders d;

  select id into v_o_a from orders where customer_id = v_cust and shop_id = v_shop_a order by placed_at desc limit 1;
  select id into v_o_b from orders where customer_id = v_cust and shop_id = v_shop_b order by placed_at desc limit 1;
  select id into v_o_c from orders where customer_id = v_cust and shop_id = v_shop_c order by placed_at desc limit 1;

  -- 1) pending: the customer says the item was not as described
  insert into complaints (order_id, filed_by, accused_id, filed_by_role, accused_role, reason_code, description, evidence_urls, status, created_at)
  values (v_o_a, v_cust, v_own_a, 'customer', 'seller', 'not_as_described',
          '[DEMO] The colour and fabric are different from the listing photos.',
          array['https://example.com/evidence/colour-mismatch.jpg'], 'submitted', now() - interval '1 day');

  -- 2) upheld: item never delivered, the seller did not respond
  insert into complaints (order_id, filed_by, accused_id, filed_by_role, accused_role, reason_code, description, evidence_urls,
                          status, decision_note, decided_by, created_at, decided_at)
  values (v_o_b, v_cust, v_own_b, 'customer', 'seller', 'not_delivered',
          '[DEMO] The parcel never arrived and the seller stopped replying.',
          array['https://example.com/evidence/courier-no-record.png'],
          'upheld', 'Courier has no pickup record and the seller did not respond within 48 hours.', v_admin,
          now() - interval '5 days', now() - interval '3 days');
  update orders set payment_status = 'refunded' where id = v_o_b;

  -- 3) rejected: a seller claims false non-receipt, but the delivery proof contradicts it
  insert into complaints (order_id, filed_by, accused_id, filed_by_role, accused_role, reason_code, description, evidence_urls,
                          response_text, responded_at, status, decision_note, decided_by, created_at, decided_at)
  values (v_o_c, v_own_c, v_cust, 'seller', 'customer', 'false_claim',
          '[DEMO] Customer says the shoes were not received, but tracking shows delivery.',
          array['https://example.com/evidence/tracking.png'],
          'I did not receive any call from the courier.', now() - interval '3 days' - interval '12 hours',
          'rejected', 'Courier proof shows a failed delivery attempt caused by the seller wrong address, so no action on the customer.', v_admin,
          now() - interval '4 days', now() - interval '2 days');
  update orders set payment_status = 'released' where id = v_o_c;
end $$;

select status, reason_code, filed_by_role || ' -> ' || accused_role as direction
from complaints where description like '[DEMO]%' order by created_at;
