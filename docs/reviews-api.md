# Platform reviews API

Reviews of Dokan AI itself, shown on the home page. These are not product reviews and not complaints.
A review is public only after an admin approves it. One review per user.

Run `scripts/reviews.sql` once in the Supabase SQL Editor before using these endpoints.
All replies are `{ data }` on success or `{ error: { code, message } }` on failure.

| Endpoint | Who | What |
| --- | --- | --- |
| `GET /api/reviews?limit=6` | anyone | Approved reviews, newest first (limit 1 to 50, default 6), plus `summary: { count, average }`. Names are first name + last initial. |
| `POST /api/reviews` | signed in | Body `{ rating: 1-5, body: 10-500 chars }`. Saved as `pending`. Errors: `invalid_review` (400), `already_reviewed` (409), 401. |
| `GET /api/reviews/mine` | signed in | `{ review }` with its status, or `null`. |
| `GET /api/admin/reviews?status=pending` | admin | `pending`, `approved` or `hidden`. Includes the full name. |
| `PATCH /api/admin/reviews/:id` | admin | Body `{ status: "approved" | "hidden" }`. Records who decided and when. |
