import test from 'node:test';
import assert from 'node:assert/strict';
import { fallbackTips } from './bnTips.mjs';
import { cleanAnalysis } from './analyzeShop.mjs';

const data = {
  summary: { views_30d: 120, purchases_30d: 3 },
  platform: { demand_gap: [{ name: 'maroon panjabi', searches_30d: 40, listings: 0, signal: 'high_opportunity' }], trending_categories: [{ custom_category: 'sari', trending_products: 2 }] },
  insights: [{ type: 'restock', name: 'Red Sari', purchases_30d: 4, text: 'x' }],
  worst_products: [{ name: 'Navy Kurti', views_30d: 55, purchases_30d: 0 }],
};

test('gives exactly 3 Bangla tips with Bangla digits and the real product names', () => {
  const r = fallbackTips(data, 'bn');
  assert.equal(r.actions.length, 3);
  assert.match(r.actions[0].text, /maroon panjabi/);
  assert.match(r.actions[0].text, /৪০/);
  assert.match(r.summary, /১২০/);
  assert.ok(r.actions.every((a) => /[\u0980-\u09FF]/.test(a.title + a.text)));
});

test('English fallback works and never exceeds 3 tips', () => {
  const r = fallbackTips(data, 'en');
  assert.equal(r.actions.length, 3);
  assert.match(r.actions[0].text, /40 times/);
});

test('thin data still returns a tip instead of nothing', () => {
  const r = fallbackTips({ summary: { views_30d: 0, purchases_30d: 0 }, platform: { demand_gap: [], trending_categories: [] }, insights: [], worst_products: [] }, 'bn');
  assert.equal(r.actions.length, 1);
});

test('Gemini output is capped at 3 actions', () => {
  const raw = { headline: 'h', summary: 's', watch_out: '', actions: Array.from({ length: 5 }, (_, i) => ({ title: 't' + i, text: 'x', priority: 'high' })) };
  assert.equal(cleanAnalysis(raw).actions.length, 3);
});
