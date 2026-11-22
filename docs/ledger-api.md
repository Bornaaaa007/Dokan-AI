# Payment ledger API (PRD PAY-5)

Send `Authorization: Bearer <session.access_token>`. Errors look like `{ "error": { "code", "message" } }`.
**Sandbox only: no real money moves. Show the sandbox banner (PAY-6).**

One ledger entry per order whose payment succeeded (`held`, `released` or `refunded`). Pending and failed payments are not in the ledger.

| Endpoint | Who | Notes |
|---|---|---|
| `GET /api/seller/ledger` | Seller | Their own shop only. `shop_id` is ignored. A seller with no shop gets an empty ledger. |
| `GET /api/admin/ledger` | Admin | Every shop. Adds `customer_id` to each entry. `?shop_id=<uuid>` narrows to one shop. |

**Query (both):** `format=json|csv` (default json), `status=held|released|refunded`, `from=YYYY-MM-DD`, `to=YYYY-MM-DD` (both inclusive, Dhaka days, filter on the order's placed date), `page` and `limit` (json only; limit 1 to 200, default 50).

**JSON reply:** `{ data: { entries: [...], summary }, meta: { page, limit, total } }`. The summary covers every matching row, not just the page.

**Entry fields:** `order_id, shop_id, shop_name, payment_method, item_total, delivery_charge, order_total, paid_online, commission_rate, commission_amount, seller_payout, escrow_status, order_status, commission_booked, paid_to_seller, refunded_amount, placed_at, paid_at, delivered_at, released_at, refunded_at` (+ `customer_id` for admin).

- `seller_payout` = `item_total` - `commission_amount` (PAY-3). It is what the seller gets once the money is released.
- `commission_booked` and `paid_to_seller` are 0 until the escrow is `released`. `refunded_amount` is the amount paid online, once `refunded`.
- `paid_online` is `order_total`, or only the delivery charge for cash on delivery.
- Orders paid before the ledger columns were added have `null` for `paid_at`, `released_at` and `refunded_at`.

**Summary fields:** `orders, item_total, in_escrow` (seller payout still held), `commission_booked, paid_to_sellers, refunded, orders_held, orders_released, orders_refunded`.

**CSV download:** `GET /api/seller/ledger?format=csv`. The reply is a file (`Content-Disposition: attachment`), UTF-8 with a BOM so Excel shows Bangla names. Dates are in Dhaka time. The frontend must fetch it with the Bearer header and save the blob; a plain link will not send the token:

```js
const res = await fetch('/api/seller/ledger?format=csv', { headers: { Authorization: `Bearer ${token}` } });
const url = URL.createObjectURL(await res.blob());
Object.assign(document.createElement('a'), { href: url, download: 'ledger.csv' }).click();
URL.revokeObjectURL(url);
```

**Limit:** more than 10,000 matching rows returns 413 `too_many_rows`; narrow with `from` and `to`.
Codes: `seller_only` (403), `admin_only` (403), `not_signed_in` (401), `bad_query` (400), `too_many_rows` (413).
