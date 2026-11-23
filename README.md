# Dokan AI – Next.js app
# DOKAN AI

**Project Name:** Dokan AI  
**Team Name:** Yuki_no_Hana

**Team Members:**
- Shamima Akther Borna
- Lamiya Rahman Khan
- Umma Hafsa Kashfi

## 1. Problem & Solution Summary

**Problem:** Small fashion businesses in Bangladesh lack proper digital storefronts and management tools. Customers struggle to find matching outfits within their budgets and face trust issues when shopping online.

**Solution:** Dokan AI is an AI-powered fashion marketplace connecting small sellers with customers through digital shops, personalized outfit recommendations, and a safer shopping experience.

## 2. Features & How AI Works

**Main Features:**
- Digital shops for sellers.
- Product browsing, search, and filtering.
- AI Personal Stylist.
- Budget-friendly outfit recommendations.
- Shopping cart and order tracking.
- Seller analytics.
- Complaint management and fraud-warning badges.
- Admin dashboard.

**How AI Works:**
1. Customer enters occasion, preferences, and budget.
2. Gemini understands the request.
3. Backend retrieves matching products from the database.
4. Rule-based logic selects products and calculates the total.
5. Gemini generates personalized styling suggestions.

## 3. Tech Stack, Models, APIs & Datasets

- **Frontend:** Next.js, React, JavaScript, CSS.
- **Backend:** Next.js API Routes.
- **Database:** Supabase (PostgreSQL).
- **AI Model:** Google Gemini 2.5 Flash.
- **APIs:** Gemini API, Supabase API, REST APIs.
- **Dataset:** Structured product catalog, sample product records, seller information, prices, sizes, colors, and marketplace activity logs.
- **Training:** No custom ML model training; uses an LLM with rule-based recommendation logic.

## 4. AI Tools Used

- **Google Gemini:** Understands customer requests and generates styling suggestions.
- **Gemini API:** Integrates the AI model into the application.
- **Rule-Based Recommendation Engine:** Selects suitable products and ensures budget limits.
- **Supabase Edge Functions:** Connects AI processing with marketplace data.

## 5. Third-Party Code, Assets & Credits

- **Next.js & React:** Frontend framework.
- **Supabase:** Database and backend services.
- **Google Gemini:** AI integration.
- **npm Packages:** Third-party libraries listed in `package.json`.
- **Assets:** Product images stored in the project's `public/images/` directory.

Third-party assets and libraries retain their respective licenses and attribution requirements.

**Original Development:** Team Yuki_no_Hana.

---

**Dokan AI — Smart Shopping, Smarter Styling.**










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

## Newer AI features
- **Shop the Look on the home page** (`components/HomeShopTheLook.js`) links to `/look`. The AI Stylist section and Shop the Look are fully Bangla/English (use the বাংলা toggle).
- **Seller AI tips in Bangla** (`lib/ai/analyzeShop.mjs`, `lib/ai/bnTips.mjs`): exactly 3 tips built from the shop's own numbers (demand gaps, restocks, underperformers, trends). If Gemini is busy, 3 rule-based tips are returned instead (`source: "rules"`).
- **Complaint triage** (`POST /api/admin/complaints/:id/triage`, admin only): Gemini summarises the thread and suggests uphold / reject / need more info with reasons. It writes nothing; the admin still records the decision via `PATCH .../decision`. Gemini sees roles and facts only, never names, ids or contact details.
- Needs `GEMINI_API_KEY` on the server. `npm test` sets `ENABLE_DEV_USER_HEADER=true` itself (lib/test-setup.cjs).
