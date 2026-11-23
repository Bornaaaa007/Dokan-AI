// Asks Gemini to look at one product photo and suggest listing fields.
// The seller always reviews the result. Gemini never sets price or stock.
const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const CATEGORIES = ['clothing', 'shoes', 'jewelry', 'accessories'];
const GENDERS = ['female', 'male', 'unisex'];
const AGES = ['adult', 'child', 'elderly'];
const OCCASIONS = ['wedding', 'eid', 'party', 'formal', 'casual'];
const FALLBACK_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.6-flash'];

const SYSTEM = `You help small fashion sellers in Bangladesh list products from a photo.
Describe only what you can see. Never guess the price, brand, fabric you cannot see, or stock.
- name: short product title, max 80 characters.
- category: one of clothing, shoes, jewelry, accessories.
- custom_category: the product type in one or two words (sari, kurti, three-piece, panjabi, heels, necklace...).
- gender: female, male or unisex. age_group: adult, child or elderly.
- colors: main colours in lowercase English (maroon, navy, gold).
- occasions: any that fit from wedding, eid, party, formal, casual.
- description: 2 or 3 plain sentences about the look and use. Do not invent details you cannot see.
Write name and description in the requested language: "en" English, "bn" Bangla script.`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING' },
    category: { type: 'STRING', enum: CATEGORIES },
    custom_category: { type: 'STRING' },
    gender: { type: 'STRING', enum: GENDERS },
    age_group: { type: 'STRING', enum: AGES },
    colors: { type: 'ARRAY', items: { type: 'STRING' } },
    occasions: { type: 'ARRAY', items: { type: 'STRING', enum: OCCASIONS } },
    description: { type: 'STRING' },
  },
  required: ['name', 'category', 'gender', 'age_group', 'colors', 'occasions', 'description'],
};

const pick = (v, allowed) => (allowed.includes(v) ? v : null);

export function cleanSuggestion(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const text = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  return {
    name: text(r.name, 100),
    category: pick(r.category, CATEGORIES),
    custom_category: text(r.custom_category, 40).toLowerCase(),
    gender: pick(r.gender, GENDERS),
    age_group: pick(r.age_group, AGES),
    colors: (Array.isArray(r.colors) ? r.colors : []).filter((c) => typeof c === 'string').map((c) => c.toLowerCase().trim()).filter(Boolean).slice(0, 5),
    occasions: (Array.isArray(r.occasions) ? r.occasions : []).filter((o) => OCCASIONS.includes(o)).slice(0, 5),
    description: text(r.description, 600),
  };
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
          generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.2 },
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
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));   // 1s, 2s, 4s
  }
  throw new Error(lastErr);
}

export async function describePhoto({ mimeType, base64, language = 'en' }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const first = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
  const models = [first, ...FALLBACK_MODELS.filter((m) => m !== first)];
  const parts = [{ inlineData: { mimeType, data: base64 } }, { text: `Language: ${language === 'bn' ? 'bn' : 'en'}. Fill the form for this product photo.` }];
  let lastErr;
  for (const m of models) {
    try { return cleanSuggestion(await callModel(apiKey, m, parts)); }
    catch (e) { lastErr = e; console.error('describePhoto failed:', e.message); }
  }
  throw lastErr;
}