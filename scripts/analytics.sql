-- ============================================================
-- Dokan AI analytics views (read-only). Safe to re-run: each view is dropped and rebuilt.
-- Windows are rolling (now() minus N days), so no timezone maths is needed.
-- Thresholds live in the CASE lines: change them there.
-- ============================================================

-- 1) DEMAND GAP: what customers search for vs how many in-stock listings exist.
drop view if exists demand_gap;
create view demand_gap as
with searches as (
  select nullif(lower(trim(filters->>'custom_category')), '') as custom_category,
         nullif(lower(trim(filters->>'color')), '')           as color,
         nullif(lower(trim(filters->>'occasion')), '')        as occasion,
         count(*)::int                                        as searches_30d
  from search_logs
  where created_at > now() - interval '30 days'
  group by 1, 2, 3
  having nullif(lower(trim(filters->>'custom_category')), '') is not null
),
supply as (
  select s.*,
    (select count(*) from products p
      where p.status = 'active'
        and jsonb_path_exists(p.variants, '$[*] ? (@.stock > 0)')
        and lower(p.custom_category) = s.custom_category
        and (s.color is null    or exists (select 1 from unnest(p.colors) c where lower(c) = s.color))
        and (s.occasion is null or s.occasion = any(p.occasion_tags))
    )::int as listings
  from searches s
)
select custom_category, color, occasion, searches_30d, listings,
       case when listings = 0 then null else round(searches_30d::numeric / listings, 1) end as searches_per_listing,
       round(searches_30d::numeric / greatest(listings, 1), 1)                            as opportunity_score,
       case
         when searches_30d < 10 then 'not_enough_data'
         when listings = 0 then 'high_opportunity'
         when searches_30d::numeric / listings >= 10 then 'high_opportunity'
         when searches_30d::numeric / listings >= 4 then 'medium'
         else 'balanced'
       end as signal
from supply;

-- 2) TRENDING PRODUCTS: weighted activity this week vs last week.
drop view if exists trending_products;
create view trending_products as
with ev as (
  select product_id, created_at,
         case type when 'view' then 1 when 'add_to_cart' then 3 when 'purchase' then 5 else 0 end as w
  from event_logs
  where product_id is not null and created_at > now() - interval '14 days'
),
agg as (
  select product_id,
         coalesce(sum(w) filter (where created_at >  now() - interval '7 days'), 0)::int as score_7d,
         coalesce(sum(w) filter (where created_at <= now() - interval '7 days'), 0)::int as score_prev_7d,
         (count(*) filter (where created_at > now() - interval '7 days'))::int            as events_7d
  from ev group by product_id
)
select p.id as product_id, p.name, p.custom_category, p.shop_id, s.name as shop_name,
       a.score_7d, a.score_prev_7d, a.events_7d,
       case
         when a.events_7d < 15 then 'not_enough_data'
         when a.score_7d > a.score_prev_7d * 1.2 then 'trending'
         else 'steady'
       end as signal
from agg a
join products p on p.id = a.product_id and p.status = 'active'
join shops s on s.id = p.shop_id;

-- 3) PRODUCT PERFORMANCE (last 30 days): best and worst performers, per shop.
drop view if exists product_performance;
create view product_performance as
with agg as (
  select product_id,
         count(*) filter (where type = 'view')::int        as views_30d,
         count(*) filter (where type = 'add_to_cart')::int as carts_30d,
         count(*) filter (where type = 'purchase')::int    as purchases_30d
  from event_logs
  where product_id is not null and created_at > now() - interval '30 days'
  group by product_id
)
select p.id as product_id, p.shop_id, s.name as shop_name, p.name, p.custom_category,
       jsonb_path_exists(p.variants, '$[*] ? (@.stock > 0)') as in_stock,
       coalesce(a.views_30d, 0) as views_30d, coalesce(a.carts_30d, 0) as carts_30d,
       coalesce(a.purchases_30d, 0) as purchases_30d,
       case when coalesce(a.views_30d, 0) = 0 then null
            else round(coalesce(a.purchases_30d, 0)::numeric / a.views_30d, 3) end as conversion,
       case
         when coalesce(a.views_30d, 0) = 0 then 'new_no_views'
         when a.views_30d < 20 then 'not_enough_data'
         when a.purchases_30d::numeric / a.views_30d >= 0.10 then 'doing_well'
         when a.purchases_30d = 0 and a.carts_30d::numeric / a.views_30d < 0.08 then 'doing_badly'
         else 'average'
       end as signal
from products p
join shops s on s.id = p.shop_id
left join agg a on a.product_id = p.id
where p.status = 'active';

-- 4) TOP SELLERS: top 3 verified shops by purchases in 30 days (minimum 5, no active fraud badge).
drop view if exists top_sellers;
create view top_sellers as
select shop_id, name, purchases_30d, rnk
from (
  select s.id as shop_id, s.name, count(*)::int as purchases_30d,
         row_number() over (order by count(*) desc, s.name) as rnk
  from event_logs e
  join shops s on s.id = e.shop_id
  where e.type = 'purchase'
    and e.created_at > now() - interval '30 days'
    and s.verification_status = 'verified'
    and not exists (
      select 1 from badges b
      where b.user_id = s.owner_id and b.role = 'seller'
        and b.status = 'active' and b.expires_at > now())
  group by s.id, s.name
  having count(*) >= 5
) t
where rnk <= 3;

-- 5) PRIVACY: these views read every shop's data with the owner's rights, so keep them
-- away from the public API keys. Your server endpoints use the secret key and decide what each person may see.
revoke all on demand_gap, trending_products, product_performance, top_sellers from anon, authenticated;
