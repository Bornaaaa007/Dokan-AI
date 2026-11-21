import { TOO_LOW_FACTOR, TOO_HIGH_FACTOR } from './scenarios.mjs';

export const bdt = (n) => Number(n).toLocaleString('en-US') + ' BDT';
export const effectivePrice = (p) => p.discount_price ?? p.price;
export const inStock = (p) => Array.isArray(p.variants) && p.variants.some((v) => Number(v.stock) > 0);

export function matchesScenario(p, sc) {
  return (
    p.status === 'active' &&
    inStock(p) &&
    (p.occasion_tags || []).includes(sc.occasion) &&
    (p.gender === sc.gender || p.gender === 'unisex') &&
    p.age_group === sc.age_group
  );
}

export function matchesSlot(p, slot) {
  if (slot.custom_categories && slot.custom_categories.includes(String(p.custom_category || '').toLowerCase())) return true;
  if (slot.categories && slot.categories.includes(p.category)) return true;
  return false;
}

// Limits come from the live catalog, never from guesses.
export function computeLimits(products, sc) {
  const candidates = products.filter((p) => matchesScenario(p, sc));
  let lowest = 0, highest = 0, anchorMin = null;
  const missingSlots = [];
  sc.slots.forEach((slot, i) => {
    const prices = candidates.filter((p) => matchesSlot(p, slot)).map(effectivePrice);
    if (!prices.length) { missingSlots.push(slot.name); return; }
    lowest += Math.min(...prices);
    highest += Math.max(...prices);
    if (i === 0) anchorMin = Math.min(...prices);
  });
  const anchorMissing = anchorMin === null;
  const floor = anchorMissing ? null : Math.max(anchorMin, Math.round(lowest * TOO_LOW_FACTOR));
  return { label: sc.label, lowest, highest, anchorMin, floor, missingSlots, anchorMissing };
}

export function checkBudget(amount, limits) {
  const { label, lowest, highest, floor, missingSlots, anchorMissing } = limits;
  if (!Number.isInteger(amount) || amount <= 0)
    return { status: 'invalid', message: 'Please tell me your budget in BDT, for example 5000 or 5k.' };
  if (anchorMissing)
    return { status: 'unavailable', message: `We don't have enough ${label} items in stock yet to build an outfit.` };
  if (amount < floor)
    return { status: 'too_low', message: `A complete ${label} outfit for ${bdt(amount)} isn't realistic. The lowest full look we have is ${bdt(lowest)}. You could raise your budget, or I can show single items instead.` };
  if (amount > highest * TOO_HIGH_FACTOR)
    return { status: 'too_high', message: `Dokan AI focuses on affordable small-business fashion. The best complete looks we have cost up to about ${bdt(highest)}, so I won't pad an outfit just to reach ${bdt(amount)}.` };
  if (amount < lowest)
    return { status: 'partial', missingSlots, message: `${bdt(amount)} won't cover a complete look (the lowest full look is ${bdt(lowest)}), so I'll build the best partial outfit I can and tell you what I left out.` };
  return { status: 'ok', aboveTypical: amount > highest, missingSlots, message: '' };
}
