# Dokan AI – Full Next.js Frontend
Requires Node.js 18.17+.

    npm install
    npm run dev          # http://localhost:3000
    npm run build && npm start

## Pages
/ landing · /shop · /product/[id] · /cart (checkout) · /orders · /stylist · /complaint · /login · /seller (dashboard) · /admin

## Structure
app/ routes · components/ UI + Store.js (cart, orders, complaints state) · lib/data.js (mock shops/products/constants) · lib/stylist.js (budget-guardrail logic)

All data is mock and held in memory (resets on refresh). Replace lib/data.js and Store.js actions with API calls when the backend is ready.
