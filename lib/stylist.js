const o = (a) => a.map(([name, color, price]) => ({ name, color, price }));
export const CATALOG = {
  wedding: { label: 'Wedding guest (woman)', items: [
    { slot: 'Sari', o: o([['Cotton Sari', '#b5446e', 1100], ['Maroon Katan Sari', '#8a1538', 2300], ['Banarasi Silk Sari', '#5a0f2e', 3400]]) },
    { slot: 'Shoes', o: o([['Flat Sandals', '#2b2b3a', 500], ['Block Heels', '#2b2b3a', 900], ['Embroidered Heels', '#3a2a4a', 1300]]) },
    { slot: 'Jewelry', o: o([['Stone Earrings', '#c9a227', 350], ['Gold Jhumka Set', '#c9a227', 800], ['Necklace Set', '#d4af37', 1400]]) },
    { slot: 'Clutch', o: o([['Fabric Clutch', '#7a5a3a', 300], ['Beaded Clutch', '#9a6a3a', 500], ['Zari Clutch', '#b8863a', 700]]) }] },
  interview: { label: 'Job interview (man)', items: [
    { slot: 'Formal shirt', o: o([['Cotton Shirt', '#dfe6ee', 600], ['Slim-fit Shirt', '#c8d4e3', 900], ['Premium Shirt', '#b0c2d8', 1300]]) },
    { slot: 'Formal pants', o: o([['Gabardine Pants', '#2b2b3a', 800], ['Slim Pants', '#222233', 1200], ['Premium Pants', '#1a1a28', 1700]]) },
    { slot: 'Shoes', o: o([['Basic Oxford', '#4a3222', 1100], ['Leather Oxford', '#3a2518', 1700], ['Premium Oxford', '#2a1a10', 2400]]) },
    { slot: 'Watch', o: o([['Basic Watch', '#9aa0a6', 500], ['Classic Watch', '#7d848b', 900], ['Steel Watch', '#5f666d', 1400]]) }] },
  eid: { label: 'Eid (woman)', items: [
    { slot: 'Kurti / Three-piece', o: o([['Printed Kurti', '#2e7d6b', 900], ['Embroidered Three-piece', '#1f6b5a', 1700], ['Festive Three-piece', '#0f5a4a', 2600]]) },
    { slot: 'Shoes', o: o([['Flat Sandals', '#2b2b3a', 500], ['Block Heels', '#2b2b3a', 800], ['Party Heels', '#3a2a4a', 1200]]) },
    { slot: 'Jewelry', o: o([['Stone Earrings', '#c9a227', 350], ['Jhumka Set', '#c9a227', 700], ['Necklace Set', '#d4af37', 1200]]) }] },
};

export const bdt = (n) => n.toLocaleString('en-BD') + ' BDT';
export const sum = (key, pick) => pick.reduce((s, t, i) => s + (t < 0 ? 0 : CATALOG[key].items[i].o[t].price), 0);

/** Budget guardrails from the PRD (section 5.3). Swap this for a backend call later. */
export function buildOutfit(key, budget) {
  const items = CATALOG[key].items;
  const lowest = items.reduce((s, i) => s + i.o[0].price, 0);
  const highest = items.reduce((s, i) => s + i.o[2].price, 0);
  const mid = Math.round((lowest + highest) / 2);
  if (!(budget > 0)) return { error: `Please enter a budget in BDT, or choose low / medium / high: ${bdt(lowest)} · ${bdt(mid)} · ${bdt(highest)}.` };
  if (budget < items[items.length - 1].o[0].price)
    return { error: `Honestly, a complete outfit for ${bdt(budget)} isn't achievable. The lowest realistic full look is about ${bdt(lowest)}. I can show a single accessory within budget, or you can raise the budget.` };
  const pick = items.map(() => 0);
  for (let i = pick.length - 1; i >= 0 && sum(key, pick) > budget; i--) pick[i] = -1;
  for (let up = true; up; ) {
    up = false;
    pick.forEach((t, i) => {
      if (t < 0 || t > 1 || budget >= highest * 1.25) return;
      const d = items[i].o[t + 1].price - items[i].o[t].price;
      if (sum(key, pick) + d <= budget) { pick[i]++; up = true; }
    });
  }
  const note = budget > highest * 1.8 ? `Dokan AI focuses on affordable small-business fashion, so I won't pad the look just to reach ${bdt(budget)}. Here are the best premium-range options we actually have.` : '';
  return { pick, note };
}

export function swapItem(key, pick, i, budget) {
  const n = CATALOG[key].items[i].o.length;
  for (let k = 1; k <= n; k++) {
    const next = pick.slice(); next[i] = ((pick[i] < 0 ? 0 : pick[i]) + k) % n;
    if (sum(key, next) <= budget) return next;
  }
  return pick;
}
