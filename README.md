# Dokan AI – Next.js app

Requires Node.js 18.17+.

    npm install
    npm run dev          # http://localhost:3000
    npm run build && npm start
    npm test             # backend unit tests

## Pages
/ home · /shop · /product/[id] · /cart (checkout) · /orders · /stylist · /complaint · /profile · /login · /seller (Seller Hub) · /admin

## How it works
- Products and shops load from Supabase (lib/catalog.js). The cart is in memory (components/Store.js).
- Orders, payments (sandbox), complaints, ledger, analytics and admin tools are real: they go through the API in app/api/ using lib/api.js with the user's login token.
- The AI stylist runs as a Supabase Edge Function (dokan-stylist/).
- No real money moves. Payments are a sandbox.

## Backend
API docs are in docs/. SQL to run once in Supabase: scripts/shops.sql, scripts/orders.sql, scripts/security.sql (plus the ledger and analytics SQL). Never re-run schema.sql or seed.sql (they wipe the data).
On the deployed site set SUPABASE_URL, SUPABASE_SECRET_KEY, the two NEXT_PUBLIC_ Supabase keys and DISABLE_DEV_USER_HEADER=true.