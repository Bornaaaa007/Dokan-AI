// Shop the look, step 2: turn what Gemini saw into REAL products from our catalog.
// Pure functions: no AI, no network. That makes the ranking easy to test and easy to explain to judges.
export const MIN_SCORE = 4;   // needs at least a colour match or a product-type match

const norm = (s) => String(s ?? '').toLowerCase().trim();
const WHO = { female: 'Women', male: 'Men' };

// Same labels the shop page uses for p.gender (Women, Men, Children, Elderly). Unisex means "no filter".
export function audienceOf(item) {
  if (item.age_group === 'child') return 'Children';
  if (item.age_group === 'elderly') return 'Elderly';
  return WHO[item.gender] ?? null;
}

const colorsOf = (p) => (Array.isArray(p.colors) && p.colors.length ? p.colors : [p.color]).map(norm).filter(Boolean);
const tagsOf = (p) => (Array.isArray(p.tags) && p.tags.length ? p.tags : [p.occasion]).map(norm).filter(Boolean);

// Returns { score, reasons } or null when the product cannot be a match at all.
export function scoreProduct(item, p) {
  if (p.type !== item.category) return null;
  if ((p.stock ?? 1) <= 0) return null;
  const who = audienceOf(item);
  if (who && p.gender !== who && !p.unisex) return null;

  let score = 1;
  const reasons = [];

  const want = norm(item.custom_category), have = norm(p.cat);
  if (want && have && (have.includes(want) || want.includes(have))) { score += 5; reasons.push(`type: ${have}`); }

  const mine = colorsOf(p);
  const hits = (item.colors || []).map(norm).filter((c) => c && mine.some((m) => m.includes(c) || c.includes(m)));
  for (const c of hits.slice(0, 2)) { score += 3; reasons.push(`colour: ${c}`); }

  const tags = tagsOf(p);
  for (const o of (item.occasions || []).map(norm)) if (tags.includes(o)) { score += 1; reasons.push(`occasion: ${o}`); }

  return { score, reasons };
}

// items: Gemini's detected pieces. products: the PRODUCTS array. isFlagged(p): seller has verified complaints (ranked lower).
export function matchLook(items, products, { top = 3, isFlagged = () => false } = {}) {
  return items.map((item) => {
    const matches = products
      .map((p) => {
        const s = scoreProduct(item, p);
        if (!s) return null;
        const flagged = !!isFlagged(p);
        return { p, reasons: s.reasons, flagged, score: s.score - (flagged ? 2 : 0) };
      })
      .filter((m) => m && m.score >= MIN_SCORE)
      .sort((a, b) => b.score - a.score || a.p.price - b.p.price)
      .slice(0, top);
    return { item, matches };
  });
}