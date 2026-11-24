# Dokan AI

> **Smart Shopping, Smarter Styling.** An AI-powered fashion marketplace for small sellers in Bangladesh.

- **Project name:** Dokan AI
- **Team name:** Yuki_no_Hana
- **Team members:**
  - Shamima Akther Borna
  - Lamiya Rahman Khan
  - Umma Hafsa Kashfi
- **Event:** CoU AI Hackathon 2026 (Comilla University)
- **Domain:** Business and Industry (primary) · FinTech / Accessibility (secondary: escrow payments, Bangla-first UI)
- **Live link:** `TODO: https://<your-deployment-url>`
- **Demo video (max 3 min):** `TODO: <video-url>`
- **Test credentials** (customer / seller / admin): `TODO: fill in before submission`

> Payments are a **sandbox**. No real money moves.

---

## 1. Problem & Solution Summary

**Problem.** Small fashion businesses in Bangladesh sell through chat inboxes and social pages. They have no proper digital storefront, no analytics and no dispute process. Customers struggle to find matching outfits within a budget and have trust issues when buying online.

**Solution.** Dokan AI connects small sellers and customers through verified digital shops, an AI Personal Stylist that builds a full outfit inside a budget, escrow-style sandbox payments, a complaint process and fraud-warning badges, plus AI tools that help sellers list products and understand their shop.

## 2. Features & How the AI Works

### Main features
- Digital shops for sellers, product browsing, search and filtering
- Shopping cart, sandbox checkout (bKash-style), order tracking
- Escrow ledger: money is held until delivery is confirmed, then released to the seller
- Seller Hub: products, orders, earnings, analytics, Premium plan (sandbox)
- Complaints with seller response, admin decision and fraud-warning badges
- Admin dashboard: shop verification, refunds, payouts, ledger CSV, review moderation
- Product and platform reviews, top-sellers ranking
- Full Bangla / English interface (toggle in the navbar)

### AI features
| Feature | Where | What the AI does | What our code does |
| --- | --- | --- | --- |
| **AI Personal Stylist** | `dokan-stylist/` (Supabase Edge Function), `/stylist` | Gemini extracts occasion, who it is for, budget and colours from free text (English, Bangla or Banglish), then writes the friendly reply | Searches real products, applies guardrails, builds the bundle and totals the price. Replies that mention numbers we did not supply are rejected |
| **Shop the Look** | `lib/visual/`, `/look` | Gemini lists the separate fashion pieces visible in an outfit photo (never the person) | `match.mjs` matches each piece to real in-stock products |
| **Message to update** | `lib/ai/parseSellerMessage.mjs`, `lib/ai/messageUpdate.mjs`, `components/MessageUpdate.js` | Gemini only extracts product name, price, sizes and stock from a pasted chat message | Plain code matches the seller's own products, validates numbers, asks to confirm weak matches; nothing is saved until the seller confirms, and it can be undone. Sellers paste the text; direct Messenger needs a Meta app review |
| **Honest bundle solver** | `dokan-stylist/supabase/functions/stylist-chat/logic.ts` (`buildBundle`, `repairBundle`) | Gemini writes the wording from facts | Missing slots are named and the partial total is true; a too-low budget returns the cheapest real complete look plus real single items; sold-out items are re-checked on screen and at Add to cart, then replaced from the same slot inside the budget or reported |
| **Photo to listing** | `lib/ai/describePhoto.mjs` | Gemini suggests name, category, colours, occasions and description from a product photo | Seller always reviews; the AI never sets price or stock |
| **Seller AI tips (Bangla/English)** | `lib/ai/analyzeShop.mjs`, `lib/ai/bnTips.mjs` | Gemini writes exactly 3 coaching tips from the shop's own 30-day numbers | Numbers come from our database. If Gemini is busy, 3 rule-based tips are returned (`source: "rules"`) |
| **Complaint triage** | `lib/ai/triageComplaint.mjs`, `POST /api/admin/complaints/:id/triage` | Gemini summarises the thread and suggests uphold / reject / need more info | Admin only; writes nothing; the admin records the decision. Gemini sees roles and facts only, never names, ids or contact details |

**Design principle:** the LLM understands language and writes words; deterministic code does the product search, price maths, budget limits and every money or status change.

## 3. Tech Stack, Models, APIs & Datasets

- **Frontend:** Next.js 14 (App Router), React 18, JavaScript, CSS
- **Backend:** Next.js API Routes (`app/api/`), business logic in `lib/`
- **Database / storage / auth:** Supabase (PostgreSQL, Storage, Auth)
- **Edge function:** Supabase Edge Function in Deno / TypeScript (`dokan-stylist/supabase/functions/stylist-chat`)
- **AI models (Google Gemini via REST):**
  - `gemini-2.5-flash`: AI Stylist (Edge Function)
  - `gemini-3.1-flash-lite` (default, override with `GEMINI_MODEL`), with fallbacks `gemini-3.5-flash-lite` and `gemini-3.6-flash`: seller tips, photo-to-listing, Shop the Look, complaint triage
- **APIs:** Google Gemini API, Supabase API, Resend (optional transactional email), internal REST API (documented in `docs/`)
- **Datasets:** our own structured product catalog (about 80 sample products with photos), sample shops, orders, complaints and marketplace activity logs (`dokan-stylist/seed.sql`, `scripts/*.sql`, `scripts/seed-logs.mjs`). All sample data was created by the team.
- **Training:** no custom model training; LLM plus rule-based recommendation logic.
- **Tests:** 294 backend unit tests (`npm test`, Node's built-in test runner) and 47 stylist tests (`npm run test:stylist`: solver plus the full request flow). `npm run test:all` runs both.

## 4. AI Tools Used (and for what)

**In the product (runtime):**
- **Google Gemini API**: language understanding, image understanding, Bangla/English text generation (see section 2)
- **Rule-based engines**: bundle building and budget limits, demand-gap and restock insights, complaint rules, escrow ledger

**While building (coding assistants):**
`TODO: list every assistant the team used and for what, e.g. "Claude: debugging and code review", "ChatGPT: ...", "Copilot: ...". Undisclosed tools can cost points (rule 13).`

## 5. Third-Party Code, Assets & Credits

- **Next.js, React**: web framework (MIT)
- **@supabase/supabase-js, @supabase/server**: database, storage and auth client (MIT / Apache-2.0)
- **Google Gemini**: AI models and API
- **Resend**: optional email delivery
- **npm packages**: see `package.json` and `package-lock.json`
- **Product images** in `public/images/`: `TODO: state the source and licence of these photos (own photos, stock site, generated, etc.)`

Third-party libraries and assets keep their own licences. All application code was written by Team Yuki_no_Hana.

---

## 6. Setup

Requires **Node.js 18.17+** and a Supabase project.

```bash
git clone <repo-url>
cd Dokan-AI
npm install
cp .env.example .env.local     # then fill in the values
npm run dev                    # http://localhost:3000
```

**Other commands**
```bash
npm run build && npm start     # production build
npm test                       # backend unit tests (sets ENABLE_DEV_USER_HEADER itself)
```

**Database (run once in Supabase → SQL Editor)**
1. `dokan-stylist/schema.sql` and `dokan-stylist/seed.sql`, **on a fresh project only**. Never re-run them later; they wipe data.
2. `scripts/shops.sql`, `scripts/orders.sql`, `scripts/security.sql`, `scripts/storage.sql`, plus the ledger, complaints, reviews and analytics SQL in `scripts/`.

**AI Stylist Edge Function**
```bash
cd dokan-stylist
supabase functions deploy stylist-chat
supabase secrets set GEMINI_API_KEY=<key>
```

**Environment variables** (see `.env.example`; never commit real keys)

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Gemini access (server only) |
| `GEMINI_MODEL` | Optional model override |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Server-side Supabase access |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser Supabase client |
| `RESEND_API_KEY`, `MAIL_FROM` | Optional email (without a key, emails are only logged) |
| `ISSUE_BADGES` | `true` to let upheld complaints issue fraud badges |
| `ENABLE_DEV_USER_HEADER` | Local testing only. Leave unset in production; it is ignored when `NODE_ENV=production` |

## 7. Project map

```
app/            pages and API routes (/shop, /stylist, /look, /cart, /orders, /seller, /admin, ...)
components/     React components
lib/            backend logic: orders, ledger, complaints, shops, analytics, ai/, visual/ (+ tests)
dokan-stylist/  AI Stylist: Supabase Edge Function, schema.sql, seed.sql
scripts/        SQL and helper scripts
docs/           API docs (docs/contract.md first) and DEMO_SCRIPT.md
```

Pages: `/` home · `/shop` · `/product/[id]` · `/cart` · `/orders` · `/stylist` · `/look` · `/complaint` · `/profile` · `/login` · `/seller` · `/admin`

## 8. Known limitations / future work

Chat, wishlist, vouchers, notifications, real payment gateways, courier tracking, saved addresses, partial refunds, scheduled automatic payouts and admin two-factor login are not built yet.
