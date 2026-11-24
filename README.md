# Dokan AI

> **Smart Shopping, Smarter Styling.** An AI-powered fashion marketplace for small sellers in Bangladesh.

![Next.js](https://img.shields.io/badge/Next.js-14-black) ![React](https://img.shields.io/badge/React-18-blue) ![Supabase](https://img.shields.io/badge/Supabase-Postgres-green) ![Gemini](https://img.shields.io/badge/Google-Gemini-orange) ![Tests](https://img.shields.io/badge/tests-294%20passing-brightgreen)

| | |
| --- | --- |
| **Project name** | Dokan AI |
| **Team name** | Yuki_no_Hana |
| **Team members** | Shamima Akther Borna · Lamiya Rahman Khan · Umma Hafsa Kashfi |
| **Event** | CoU AI Hackathon 2026 (Comilla University) |
| **Domain** | Business and Industry (primary) · FinTech / Accessibility (secondary: escrow payments, Bangla-first UI) |
| **Live link** | https://dokan-ai-murex.vercel.app/ |
| **Demo video (max 3 min)** | TODO: `<video-url>` |

## Test credentials

Demo accounts for judges. Sign in at the live link.

| Role | Email | Password |
| --- | --- | --- |
| **Customer** | `thekashfi71@gmail.ocm` | `@#anas2020` |
| **Seller** | `jane@gmail.com` | `@#jane@#` |
| **Admin** | `dokanai@gmail.com` | `dokanAI@#` |

> **Payments are a sandbox. No real money moves.**

---

## 1. Problem & Solution Summary

### Problem

Across Bangladesh, thousands of small fashion businesses run from living rooms and bedrooms. Many owners are women working from home, and many have never used anything more than Facebook and a phone. They sell through chat inboxes and social pages, so they have:

- no proper online shop, so every sale means answering the same messages again and again;
- no idea what customers want, which products sell, or when to restock;
- no safe way to handle a dispute, so one bad order can hurt their name;
- no time or skill to write product descriptions, take "professional" listings or read a dashboard.

Customers have the opposite problem. They cannot easily find a matching outfit within a budget, and they hesitate to pay an unknown seller because they have been cheated before.

### Solution

**Dokan AI** is a Bangla-first fashion marketplace built so that a seller with no technical background can still run a real online shop.

- **Easy for the seller.** Upload a photo and the AI suggests the product name, category, colours and description. The seller only checks and confirms. The AI never sets price or stock.
- **Advice in plain words.** Each seller gets 3 short tips in everyday spoken Bangla, based on their own shop's last 30 days, for example what customers are searching for that nobody stocks. No charts or jargon are needed to understand them.
- **Trust for the customer.** Payments are held in escrow until delivery is confirmed. There is a complaint process, admin review and fraud-warning badges.
- **Easy for the customer.** An AI Personal Stylist builds a full outfit (clothes, shoes, jewellery, bag) inside the customer's budget from a simple sentence in English, Bangla or Banglish. Shop the Look finds matching real products from an outfit photo.
- **Safe AI.** The AI understands language and writes words. Our own code does the product search, price maths, budget limits and every money or status change, and a human admin makes every complaint decision.

### Who it is for

| User | What they get |
| --- | --- |
| **Home-based and first-time sellers**, with little digital experience | A ready shop, AI-written listings, Bangla tips, protected payments |
| **Growing small brands** | Analytics, demand-gap and restock insights, a Premium plan, a top-sellers ranking |
| **Customers** | Budget-based outfit bundles, search by photo, escrow-protected checkout |
| **Marketplace admins** | Shop verification, complaint triage assistant, refunds, payouts, ledger CSV |

---

## 2. Features & How the AI Works

### Main features

- Digital shops for sellers, product browsing, search and filtering
- Shopping cart, sandbox checkout (bKash-style), order tracking
- **Escrow ledger:** money is held until delivery is confirmed, then released to the seller
- **Seller Hub:** products, orders, earnings, analytics, Premium plan (sandbox)
- Complaints with seller response, admin decision and fraud-warning badges
- **Admin dashboard:** shop verification, refunds, payouts, ledger CSV, review moderation
- Product and platform reviews, top-sellers ranking
- Full **Bangla / English** interface (toggle in the navbar)

### AI features

| Feature | Where | What the AI does | What our code does |
| --- | --- | --- | --- |
| **AI Personal Stylist** | `dokan-stylist/` (Supabase Edge Function), `/stylist` | Gemini extracts occasion, who it is for, budget and colours from free text (English, Bangla or Banglish), then writes the friendly reply | Searches real products, applies guardrails, builds the bundle and totals the price. Replies that mention numbers we did not supply are rejected |
| **Shop the Look** | `lib/visual/`, `/look` | Gemini lists the separate fashion pieces visible in an outfit photo (never the person) | `match.mjs` matches each piece to real in-stock products |
| **Photo to listing** | `lib/ai/describePhoto.mjs` | Gemini suggests name, category, colours, occasions and description from a product photo | Seller always reviews; the AI never sets price or stock |
| **Seller AI tips (Bangla/English)** | `lib/ai/analyzeShop.mjs`, `lib/ai/bnTips.mjs` | Gemini writes exactly 3 coaching tips from the shop's own 30-day numbers | Numbers come from our database. If Gemini is busy, 3 rule-based tips are returned (`source: "rules"`) |
| **Complaint triage** | `lib/ai/triageComplaint.mjs`, `POST /api/admin/complaints/:id/triage` | Gemini summarises the thread and suggests uphold / reject / need more info | Admin only; writes nothing; the admin records the decision. Gemini sees roles and facts only, never names, ids or contact details |

> **Design principle:** the LLM understands language and writes words; deterministic code does the product search, price maths, budget limits and every money or status change.

---

## 3. Tech Stack, Models, APIs & Datasets

| Area | Technology |
| --- | --- |
| **Frontend** | Next.js 14 (App Router), React 18, JavaScript, CSS |
| **Backend** | Next.js API Routes (`app/api/`), business logic in `lib/` |
| **Database / storage / auth** | Supabase (PostgreSQL, Storage, Auth) |
| **Edge function** | Supabase Edge Function in Deno / TypeScript (`dokan-stylist/supabase/functions/stylist-chat`) |
| **APIs** | Google Gemini API, Supabase API, Resend (optional transactional email), internal REST API (documented in `docs/`) |

### AI models (Google Gemini via REST)

- `gemini-2.5-flash`: AI Stylist (Edge Function)
- `gemini-3.1-flash-lite` (default, override with `GEMINI_MODEL`), with fallbacks `gemini-3.5-flash-lite` and `gemini-3.6-flash`: seller tips, photo-to-listing, Shop the Look, complaint triage

### Datasets

Our own structured product catalog (about 80 sample products with photos), sample shops, orders, complaints and marketplace activity logs (`dokan-stylist/seed.sql`, `scripts/*.sql`, `scripts/seed-logs.mjs`). All sample data was created by the team.

### Training

No custom model training; LLM plus rule-based recommendation logic.

### Tests

294 backend unit tests (`npm test`, Node's built-in test runner) and Deno tests for the stylist function.

---

## 4. AI Tools Used (and for what)

### In the product (runtime)

- **Google Gemini API:** language understanding, image understanding, Bangla/English text generation (see section 2)
- **Rule-based engines:** bundle building and budget limits, demand-gap and restock insights, complaint rules, escrow ledger

### While building (coding assistants)

- **Claude (Anthropic):** coding assistant for writing, debugging and reviewing code.
- **Gemini (Google):** coding assistant, and also used to collect and generate product images (see section 5).

All AI-generated code was reviewed and tested by the team.

---

## 5. Third-Party Code, Assets & Credits

- **Next.js, React:** web framework (MIT)
- **@supabase/supabase-js, @supabase/server:** database, storage and auth client (MIT / Apache-2.0)
- **Google Gemini:** AI models and API
- **Resend:** optional email delivery
- **npm packages:** see `package.json` and `package-lock.json`
- **Product images** in `public/images/`: collected from Google search results and generated with Gemini. They are used for demonstration only, not for commercial use, and remain the property of their original owners.

Third-party libraries and assets keep their own licences. All application code was written by **Team Yuki_no_Hana**.

---

## 6. Setup

Requires **Node.js 18.17+** and a **Supabase project**.

```bash
git clone <repo-url>
cd Dokan-AI
npm install
cp .env.example .env.local     # then fill in the values
npm run dev                    # http://localhost:3000
```

### Other commands

```bash
npm run build && npm start     # production build
npm test                       # backend unit tests (sets ENABLE_DEV_USER_HEADER itself)
```