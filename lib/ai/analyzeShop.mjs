// Asks Gemini to read ONE shop's 30-day numbers and write a short coaching note for the owner.
// The numbers come from our own database (never from the browser). Gemini only writes the words.
const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const FALLBACK_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.6-flash'];
const PRIORITIES = ['high', 'medium', 'low'];

const SYSTEM = `You are a friendly business coach for a small fashion shop in Bangladesh.
You receive one shop's last-30-days numbers as JSON and write a short analysis for the owner.
Rules:
- Use only numbers and product names that appear in the JSON. Never invent figures, prices, products or competitors.
- If the data is thin (few views, no sales), say so honestly and give simple first steps instead of guessing.
- Plain, simple words. No jargon. Every action must be something the seller can do this week.
- Never suggest fake reviews, misleading discounts or anything against marketplace rules.
- "rule_based_tips" are hints found by our own rules. You may use them, but explain them better.
- headline: one sentence, max 100 characters.
- summary: 2 or 3 sentences on how the shop is doing.
- actions: 3 to 5 items, most important first. Each has title (max 50 characters), text (1 or 2 sentences) and priority (high, medium or low).
- watch_out: one short risk or warning, or an empty string if there is none.
Write in the requested language: "en" English, "bn" Bangla script (keep product names exactly as given).`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    headline: { type: 'STRING' },
    summary: { type: 'STRING' },
    actions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          text: { type: 'STRING' },
          priority: { type: 'STRING', enum: PRIORITIES },
        },
        required: ['title', 'text', 'priority'],
      },
    },
    watch_out: { type: 'STRING' },
  },
  required: ['headline', 'summary', 'actions', 'watch_out'],
};

// Only what the model needs, nothing about other shops.
export function compactForAi(data) {
  const prod = (p) => ({ name: p.name, views_30d: p.views_30d, carts_30d: p.carts_30d, purchases_30d: p.purchases_30d, conversion: p.conversion, in_stock: p.in_stock });
  return {
    shop_name: data.shop?.name,
    top_seller_rank: data.shop?.top_seller_rank ?? null,
    summary: data.summary,
    doing_well: (data.best_products || []).map(prod),
    needs_attention: (data.worst_products || []).map(prod),
    products_without_enough_data: data.no_data_products ?? 0,
    customer_searches_with_few_listings: (data.platform?.demand_gap || []).map((d) => ({ search: d.name, searches_30d: d.searches_30d, in_stock_listings: d.listings })),
    trending_categories_this_week: (data.platform?.trending_categories || []).map((t) => ({ category: t.custom_category, trending_products: t.trending_products })),
    rule_based_tips: (data.insights || []).map((i) => i.text),
  };
}

export function cleanAnalysis(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const text = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  const actions = (Array.isArray(r.actions) ? r.actions : [])
    .map((a) => ({ title: text(a?.title, 60), text: text(a?.text, 300), priority: PRIORITIES.includes(a?.priority) ? a.priority : 'medium' }))
    .filter((a) => a.title && a.text)
    .slice(0, 5);
  return { headline: text(r.headline, 120), summary: text(r.summary, 500), actions, watch_out: text(r.watch_out, 250) };
}

async function callModel(apiKey, model, parts) {
  let lastErr = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    let res;
    try {
      res = await fetch(`${BASE}/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: 'user', parts }],
          generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.3 },
        }),
        signal: AbortSignal.timeout(25000),
      });
    } catch (e) { lastErr = `${model}: ${e.message}`; break; }
    if (res.ok) {
      const j = await res.json();
      const text = j?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
      if (!text) throw new Error(`${model}: empty answer`);
      return JSON.parse(text.replace(/```json|```/g, '').trim());
    }
    lastErr = `${model} ${res.status}: ${(await res.text()).slice(0, 200)}`;
    if (![429, 500, 503].includes(res.status)) break;
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }
  throw new Error(lastErr);
}

export async function analyzeShop({ data, language = 'en' }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const first = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
  const models = [first, ...FALLBACK_MODELS.filter((m) => m !== first)];
  const lang = language === 'bn' ? 'bn' : 'en';
  const parts = [{ text: `Language: ${lang}.\nShop data (JSON):\n${JSON.stringify(compactForAi(data))}` }];
  let lastErr;
  for (const m of models) {
    try {
      const out = cleanAnalysis(await callModel(apiKey, m, parts));
      if (!out.summary || !out.actions.length) throw new Error(`${m}: answer had no summary or actions`);
      return out;
    } catch (e) { lastErr = e; console.error('analyzeShop failed:', e.message); }
  }
  throw lastErr;
}