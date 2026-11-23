# Dokan AI: API contract

This is the agreement between Frontend, Backend and AI/Analytics. It follows PRD section 12 and records where the built API differs from it. If you need to change a field, tell the other two first and update this file.

Detailed docs: `products-api.md`, `shops-api.md`, `orders-api.md`, `ledger-api.md`, `complaints-api.md`, `me-api.md`.

## Conventions

- JSON over REST, all paths under `/api`. Success is `{ "data": ... }` (lists add `"meta": { page, limit, total }`). Failure is `{ "error": { "code", "message" } }`.
- IDs are UUID strings. Money is a whole number of BDT. Timestamps are ISO 8601 in UTC; the app shows them in Asia/Dhaka.
- Enums are exact lowercase strings (see the PRD, section 12.3). Order status: `placed, accepted, packed, shipped, delivered, cancelled`. Payment status: `pending, paid, held, released, refunded, failed`.
- List endpoints take `page` (default 1) and `limit` (default 20, max 50).

## Auth (a change from the PRD)

The PRD lists `POST /api/auth/signup` and `/api/auth/login`. They are NOT built. Sign up and log in go straight to Supabase Auth from the browser (`supabase.auth.signUp`, `signInWithPassword`). A database trigger (`scripts/security.sql`) creates the matching `users` row, and only the roles `customer` and `seller` can be chosen at signup. Admins are promoted by hand in SQL.

Every API call sends `Authorization: Bearer <session.access_token>`. `lib/auth/current-user.mjs` is the only place that decides who is calling. The demo header `x-user-id` works only while `DISABLE_DEV_USER_HEADER` is not `true`; set it to `true` on any deployed site.

A bad or expired token returns 401 `not_signed_in` and never falls back to the demo header.

## Endpoints

Who can call: P = public, U = any signed-in user, C = customer, S = seller (shop owner), A = admin.

| Method and path | Who | Purpose |
|---|---|---|
| GET `/api/me` | U | Current user, roles and the seller's shop |
| GET `/api/products` | P | Search and filter. Premium shops sort first. Each search is logged |
| GET `/api/products/:id` | P | One product |
| POST `/api/products` | S | Create a product |
| PATCH `/api/products/:id` | S, A (status only) | Edit, or hide with `status: "hidden"`. There is no delete |
| POST `/api/shops` | U | Create a shop (starts as pending, grants the seller role) |
| GET `/api/shops/mine` | U | My shop, or `null` |
| GET `/api/shops/:id` | P | Shop. Owner and admin see more fields |
| PATCH `/api/shops/:id` | S | Edit shop (a rejected shop goes back to pending) |
| POST `/api/shops/:id/premium` | S | Buy Premium for 1, 3 or 6 months (sandbox) |
| GET `/api/admin/shops` | A | Verification queue |
| PATCH `/api/admin/shops/:id/verification` | A | Verify, or reject with a reason |
| POST `/api/events` | P | Record `view` or `add_to_cart`. `purchase` is refused; the payment writes it |
| POST `/api/orders` | C | Place an order. One shop per order |
| GET `/api/orders?as=customer\|seller\|admin` | U | List orders |
| GET `/api/orders/:id` | C, S, A | One order. Others get 404 |
| PATCH `/api/orders/:id/status` | C, S, A | Move the order along, or cancel |
| POST `/api/orders/:id/pay` | C | Sandbox payment |
| POST `/api/admin/orders/:id/refund` | A | Full refund of money still held |
| POST `/api/admin/payouts/release` | A | Release escrow 48 hours after delivery |
| POST `/api/orders/:id/complaints` | C, S | File a complaint |
| GET `/api/complaints/mine` | U | My complaints |
| POST `/api/complaints/:id/respond` | accused | Respond once |
| GET `/api/admin/complaints`, GET `/api/admin/complaints/:id` | A | Complaint queue and detail |
| PATCH `/api/admin/complaints/:id/decision` | A | `upheld` or `rejected`, with a written note |
| GET `/api/users/:id/badge`, GET `/api/shops/:id/badge` | P | Badge label and level only |
| GET `/api/seller/analytics` | S, A | Seller dashboard. A seller always gets their own shop. An admin adds `?shop_id=` |
| GET `/api/seller/ledger` | S | Own shop's payment ledger, JSON or CSV (`?format=csv`) |
| GET `/api/admin/ledger` | A | All shops' ledger, JSON or CSV. Add `?shop_id=` to narrow |
| GET `/api/admin/insights` | A | Platform trends and demand versus supply |
| GET `/api/top-sellers` | P | Top shops |

## Not built or different from the PRD

- `POST /api/auth/signup` and `/login`: replaced by Supabase Auth (above).
- `POST /api/ai/stylist/chat` and `/cart`: the stylist runs as the Supabase function `stylist-chat`, which the frontend calls directly (`lib/stylistApi.js`).
- Complaint decisions accept `upheld` and `rejected` only. There is no "partially upheld".
- Fraud badges are issued only when the server has `ISSUE_BADGES=true`.
- Not built: partial refunds, scheduled 48-hour payout (an admin calls the release endpoint), the 12-hour seller accept timeout, expiry of unpaid orders, notifications, order chat, editing or deleting a product review (product reviews and platform reviews are built, see `product-reviews-api.md` and `reviews-api.md`), wishlist, image upload, admin two-factor login.

## Rules the code follows

- Prices and totals for an order come from the server. The browser never sends a price. Delivery is 80 BDT.
- Commission is on the unit price after discount, never on delivery: 2% under 500, 3% under 1,000, 5% from 1,000. It is stored on the order when the payment succeeds.
- The shop on an event or order comes from the product, never from the client.
- A seller cannot order from their own shop. Admins cannot place orders or own shops.
- Escrow is not released while a complaint is submitted, responded, appealed or upheld.
- Only an admin can create, change or remove a badge. Nothing is automatic.
- Stock changes and money changes run as database functions, so two buyers cannot take the last item. Only the server's secret key can call them.
- The sandbox payment outcome (`success`, `failure`, `pending`) is chosen by the caller so the team can demo failures. Remove that before any real launch, and keep the "sandbox" banner visible (PRD PAY-6).
