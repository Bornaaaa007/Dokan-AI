# Products API

All replies are `{ "data": ... }` or `{ "error": { "code", "message" } }`.
Who is calling comes from `lib/auth/current-user.mjs` only (Bearer token, or the demo header `x-user-id`).

## GET /api/products  (public)
Query: `q, category, gender, age_group, color, size, occasion, min_price, max_price, shop_id, in_stock, page, limit`
- `page` default 1, `limit` default 20, max 50.
- `q` words must ALL match name, category, colour or occasion ("maroon sari" works; numbers like "5k" are ignored).
- `gender=female` also returns `unisex` items. `size` only matches sizes that have stock.
- Price filters use the price after discount (`price_now`).
- Premium (featured) shops sort first, then newest. Unverified shops are included. Rejected shops and hidden products never appear.
- Out-of-stock products ARE listed with `in_stock: false`; send `in_stock=true` to hide them.
- Reply: `{ data: [product...], meta: { page, limit, total } }`. List items have no `description`.
- Each real search (a filter or `q`, page 1 only) is written to `search_logs` with `filters` keys
  `custom_category`, `color`, `occasion` (read from the text where needed, so "purple lehenga" counts as demand even if nobody sells it).

## GET /api/products/:id  (public)
Full product with `description`. Hidden products return 404 unless you are the owner or an admin.

## POST /api/products  (seller)
Body: `name, category, gender, age_group, price, variants` required.
Optional: `description, custom_category, colors, occasion_tags, image_urls, discount_price, status, shop_id`.
`shop_id` can be left out if the seller has exactly one shop. `variants`: `[{ size, color, stock }]`.
Money is whole BDT. `discount_price` must be lower than `price`.
Errors: 401 not_signed_in, 403 seller_only / not_your_shop / shop_rejected, 409 no_shop, 400 invalid_product.

## PATCH /api/products/:id  (owner, or admin for `status` only)
Send only the fields to change. A product cannot move to another shop.
To remove a product from sale, set `status: "hidden"`. There is no delete.

## Product shape
`id, shop_id, name, description?, category, custom_category, gender, age_group, colors, occasion_tags, image_urls,
price, discount_price, price_now, variants, in_stock, status, created_at, shop: { id, name, city, verified, featured }`
