# Complaints API (for the frontend)

All responses are `{ "data": ... }` or `{ "error": { "code", "message" } }`.

**Who is calling:** send `Authorization: Bearer <session.access_token>`. In demo mode only, the header `x-user-id: <user uuid>` still works (it is ignored once a Bearer header is present).
There is no token check yet, so these endpoints trust that header. Admin endpoints require a user whose `roles` contain `admin`
(seed user "Test Admin").

## Customer or seller

| Call | Body | Notes |
|---|---|---|
| `POST /api/orders/:id/complaints` | `{ reason_code, description, evidence_urls? }` | Only the customer or the shop owner of that order. One per person per order. Max 5 per 24 hours. Returns 201. |
| `GET /api/complaints/mine` | none | Complaints I filed and complaints against me. Decision note appears only after the decision. |
| `POST /api/complaints/:id/respond` | `{ response_text, evidence_urls? }` | Only the accused. Only while status is `submitted` (one response). |

Reason codes by role:
- customer: `not_delivered`, `not_as_described`, `wrong_size`, `other`
- seller: `refused_delivery`, `false_claim`, `other`

`description` and `response_text` need 10 to 2000 characters. `evidence_urls` is a list of up to 10 `http(s)` links.

## Admin

| Call | Body | Notes |
|---|---|---|
| `GET /api/admin/complaints?status=open` | none | `open` = submitted + responded (oldest first). Or one of `submitted`, `responded`, `upheld`, `rejected`, `appealed`. Each row has `response_due_at` and `response_overdue`. |
| `GET /api/admin/complaints/:id` | none | Both sides, the order, the accused history (`upheld_before`, `has_active_badge`). |
| `PATCH /api/admin/complaints/:id/decision` | `{ outcome, decision_note, proof_confirmed? }` | `outcome` is `upheld` or `rejected` (there is no "partially upheld"). `decision_note` is required (10+ characters). |

A badge is issued only when the outcome is `upheld`, `proof_confirmed` is `true` **and** the server has `ISSUE_BADGES=true`.
Badges are switched off by default. The response says what happened in `badge_issued` and `badge_note`.

## Public badge status

`GET /api/users/:id/badge` and `GET /api/shops/:id/badge` return
`{ has_badge, label, level, roles }`. The label is "Verified complaints". Nothing about the complaint or the other party is exposed.

## Error codes

| HTTP | code | Meaning |
|---|---|---|
| 400 | `bad_id`, `invalid_complaint`, `invalid_response`, `invalid_decision`, `bad_status`, `self_order`, `note_required` | Bad input |
| 401 | `not_signed_in` | Missing or invalid login (bad token, or unknown `x-user-id` in demo mode) |
| 403 | `not_your_order`, `not_accused`, `admin_only`, `conflict_of_interest` | Not allowed |
| 404 | `order_not_found`, `complaint_not_found`, `shop_not_found` | Does not exist |
| 409 | `already_filed`, `order_cancelled`, `not_open_for_response`, `already_decided` | Wrong state |
| 429 | `too_many_complaints` | Rate limit |
| 500 | `internal` | Something went wrong (details are only in the server log) |
