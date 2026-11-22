# GET /api/me

Returns the signed-in user. Send `Authorization: Bearer <Supabase session access_token>`.

Success (200):

```json
{ "data": {
  "id": "uuid", "name": "Nilima", "email": "n@x.com", "phone": null,
  "roles": ["customer", "seller"], "gender": "female", "age_group": "adult",
  "created_at": "2026-11-01T00:00:00Z",
  "shop": { "id": "uuid", "name": "Nilima Boutique", "verification_status": "verified", "plan": "premium", "plan_expires_at": null }
} }
```

`shop` is `null` for customers and for sellers who have not created a shop. The NID is never returned.
No token or a bad token returns 401 `not_signed_in`.

Frontend use: after login, get the token with `supabase.auth.getSession()` and send it on every call.
