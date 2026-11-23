# Product reviews API

Reviews of a single product, shown on the product page. These are not platform reviews (home page) and not complaints.

A customer can review a product only from **their own delivered order** that contains it. An order whose payment was refunded (full refund or upheld complaint) can no longer be reviewed. One review per product per order.
The review is public right away (the delivered order is the proof) and carries a "Verified purchase" label. An admin can hide it.

Run `scripts/product-reviews.sql` once in the Supabase SQL Editor before using these endpoints (it needs the orders and products tables).
All replies are `{ data }` on success or `{ error: { code, message } }` on failure. `:id` is the product's database id (`p.uuid` in the app).

| Endpoint | Who | What |
| --- | --- | --- |
| `GET /api/products/:id/reviews?limit=10` | anyone | Visible reviews, newest first (limit 1 to 50, default 10), plus `summary: { count, average }`. Names are first name + last initial. 404 `product_not_found`. |
| `GET /api/products/:id/reviews/mine` | signed in | `{ eligible_order_id, review }`. `eligible_order_id` is a delivered order of yours with this product that has no review yet, or `null`. `review` is your latest review of the product, or `null`. |
| `POST /api/products/:id/reviews` | signed in | Body `{ order_id, rating: 1-5, body: 10-500 chars }`. Errors: `invalid_review` (400), `not_eligible` (403, not your order or product not in it), `not_delivered` (409), `order_refunded` (409), `already_reviewed` (409), `too_many_reviews` (429, more than 10 reviews in 24 hours), `product_not_found` (404), 401. |
| `GET /api/admin/product-reviews?status=visible` | admin | `visible` or `hidden`. Includes the full name, product name and order id. |
| `PATCH /api/admin/product-reviews/:id` | admin | Body `{ status: "visible" \| "hidden" }`. Records who decided and when. |

## Rules in one place
- Eligibility lives in `lib/product-reviews/rules.mjs` (`checkEligible`).
- The database also enforces one review per `(order_id, product_id)`, so two quick clicks cannot both succeed.
- Sample products (the hardcoded ones with no database id) have no reviews; the page says so.
- The rating count and average come from the database function `product_review_summary` (created by `scripts/product-reviews.sql`), not from loading every rating.
- Limit: 10 new reviews per customer per 24 hours.
- Not built: customers editing or deleting their own review; admins can only hide or show it.
