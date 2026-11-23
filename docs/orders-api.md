# Orders and sandbox payment API

Send `Authorization: Bearer <session.access_token>` (demo mode only: `x-user-id`). Errors look like `{ "error": { "code", "message" } }`.
**Sandbox only: no real money moves. Show the sandbox banner (PAY-6).**

| Endpoint | Who | Notes |
|---|---|---|
| `POST /api/orders` | Customer (not admin) | `{ items: [{ product_id, size, color?, qty }], payment_method?: "sandbox"\|"cod", delivery_address: { name, phone, line1, city, area? } }`. One shop per order: the frontend splits a mixed cart. Prices come from the server (discount applied), delivery is 80 BDT. Returns 201 with status `placed`, payment `pending`. |
| `POST /api/orders/:id/pay` | The customer | `{ gateway?: "bkash"\|"nagad"\|"card", outcome?: "success"\|"failure"\|"pending" }`. 200 paid (money held in escrow), 402 failed (retry allowed), 202 pending. COD orders pay only the delivery charge online. |
| `GET /api/orders?as=customer\|seller\|admin&status=&page=&limit=` | Signed in | Default `as=customer`. Seller sees their shop's orders, admin sees all. Returns `{ data, meta }`. |
| `GET /api/orders/:id` | Customer, shop owner, admin | Others get 404. Commission and seller payout only for seller and admin. |
| `PATCH /api/orders/:id/status` | See below | `{ status }` |
| `POST /api/admin/orders/:id/refund` | Admin | Full refund of money still held. |
| `POST /api/admin/payouts/release` | Admin | Releases escrow for orders delivered 48 hours ago or more, skipping any with an open or upheld complaint. |

**Status rules:** placed → accepted → packed → shipped → delivered. Cancel is possible until shipped.
Seller and admin do every step; the customer may cancel a `placed` order, or confirm a `shipped` order arrived (this releases the money at once unless a complaint is open).
Accepting, packing and shipping need a paid order (`payment_status` held or released).

**Payment status:** `pending` → `held` (escrow) → `released` (payout) or `refunded`. A failed payment is `failed` and can be retried.
**Commission** (on item price after discount, never delivery): 2% under 500, 3% under 1,000, 5% from 1,000 BDT per unit price. Fixed on the order when paid.

Codes to handle: `out_of_stock`, `variant_unavailable`, `color_required`, `multiple_shops`, `own_shop`, `payment_required`, `already_paid`, `customer_cannot`, `bad_transition`, `status_changed`.
