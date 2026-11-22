# Shops API

Replies are `{ "data": ... }` or `{ "error": { "code", "message" } }`. Identity comes from `lib/auth/current-user.mjs`.
Run `scripts/shops.sql` once first (adds `shops.rejection_note`).

## POST /api/shops   (any signed-in user)
Body: `name` (required), `description, city, social_url, nid_number, return_policy`.
Creates the shop as **pending** and gives the user the `seller` role. One shop per user (409 `shop_exists`). Admins cannot own shops.
`nid_number` is 10, 13 or 17 digits. It is stored but never sent back (owners get `nid_set: true`).

## GET /api/shops/mine   (signed in)
The caller's shop, or `{ data: null }` if they have none yet. Use this to decide between "Become a seller" and the seller dashboard.

## GET /api/shops/:id   (public)
Public view: `id, name, description, city, social_url, return_policy, verified, featured, created_at`.
Owner and admin also get `verification_status, plan, plan_expires_at, rejection_note`. Admin also gets `owner_id, nid_number`.
Rejected shops are hidden from everyone except the owner and admins.

## PATCH /api/shops/:id   (owner)
Editable: `name, description, city, social_url, return_policy, nid_number`.
`plan`, `verification_status` and `owner_id` are refused. Editing a **rejected** shop sends it back to **pending** (resubmit).
A verified shop that changes its name or NID also goes back to pending.

## POST /api/shops/:id/premium   (owner, sandbox payment)
Body: `{ "months": 1 | 3 | 6 }` costs 1,000 / 2,500 / 5,000 BDT. Sets `plan: premium` and `plan_expires_at`.
Buying while Premium is active extends from the current expiry. Reply: `{ shop, paid, months, sandbox: true }`.
An expired plan shows as `free` automatically; no data is deleted.

## GET /api/admin/shops?status=pending|verified|rejected&page=&limit=   (admin)
The review queue, oldest first, including `nid_number` and `owner_id`. Reply has `meta: { page, limit, total }`.

## PATCH /api/admin/shops/:id/verification   (admin)
Body: `{ "status": "verified" }` or `{ "status": "rejected", "reason": "..." }` (reason 3 to 500 characters, required).
The reason is saved on the shop (the owner sees it as `rejection_note`) and emailed to the owner if an email exists.
Reply: `{ shop, emailed }`. Without `RESEND_API_KEY` the email is only logged, so `emailed` is false.

## Not built
Downgrade by hand, a payment ledger (no record of who paid), the free-plan product cap, logo/cover images, payout account, and image upload.
