import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProductInput, checkPrices, parseSearchQuery } from './rules.mjs';

const good = () => ({ name: '  Maroon   Sari ', category: 'Clothing', gender: 'female', age_group: 'adult', price: 2500, variants: [{ size: 'Free', color: 'Maroon', stock: 4 }] });

test('a minimal valid product passes and is cleaned', () => {
  const { errors, value } = validateProductInput(good());
  assert.deepEqual(errors, []);
  assert.equal(value.name, 'Maroon Sari');
  assert.equal(value.category, 'clothing');
  assert.deepEqual(value.variants, [{ size: 'Free', color: 'maroon', stock: 4 }]);
});
test('create requires the main fields', () => {
  const { errors } = validateProductInput({});
  for (const f of ['name', 'category', 'gender', 'age_group', 'price', 'variants']) assert.ok(errors.some((e) => e.startsWith(f)), f);
});
test('patch only checks what was sent', () => {
  assert.deepEqual(validateProductInput({ price: 900 }, { partial: true }).errors, []);
  assert.ok(validateProductInput({ price: -5 }, { partial: true }).errors.length);
});
test('bad enums, prices and stock are rejected', () => {
  assert.ok(validateProductInput({ ...good(), category: 'food' }).errors.length);
  assert.ok(validateProductInput({ ...good(), price: 12.5 }).errors.length);
  assert.ok(validateProductInput({ ...good(), price: '2500' }).errors.length);
  assert.ok(validateProductInput({ ...good(), price: 0 }).errors.length);
  assert.ok(validateProductInput({ ...good(), variants: [{ size: 'M', stock: -1 }] }).errors.length);
  assert.ok(validateProductInput({ ...good(), variants: [] }).errors.length);
});
test('duplicate variants are rejected', () => {
  const v = [{ size: 'M', color: 'red', stock: 1 }, { size: 'm', color: 'RED', stock: 2 }];
  assert.ok(validateProductInput({ ...good(), variants: v }).errors.length);
});
test('colours and tags are lower-cased, de-duplicated and checked', () => {
  const { value, errors } = validateProductInput({ ...good(), colors: ['Maroon', 'maroon', 'Navy Blue'], occasion_tags: ['Wedding'] });
  assert.deepEqual(errors, []);
  assert.deepEqual(value.colors, ['maroon', 'navy blue']);
  assert.ok(validateProductInput({ ...good(), colors: ['<script>'] }).errors.length);
  assert.ok(validateProductInput({ ...good(), colors: Array(11).fill('red').map((c, i) => c + i + 'x') }).errors.length);
});
test('image urls must be http(s)', () => {
  assert.deepEqual(validateProductInput({ ...good(), image_urls: ['https://x.com/a.jpg'] }).errors, []);
  assert.ok(validateProductInput({ ...good(), image_urls: ['javascript:alert(1)'] }).errors.length);
  assert.ok(validateProductInput({ ...good(), image_urls: ['not a url'] }).errors.length);
});
test('custom_category and description', () => {
  assert.equal(validateProductInput({ ...good(), custom_category: ' Three-Piece ' }).value.custom_category, 'three-piece');
  assert.equal(validateProductInput({ ...good(), custom_category: '' }).value.custom_category, null);
  assert.ok(validateProductInput({ ...good(), description: 'x'.repeat(2001) }).errors.length);
});
test('discount must be lower than price', () => {
  assert.equal(checkPrices(2000, 1500), null);
  assert.equal(checkPrices(2000, null), null);
  assert.ok(checkPrices(2000, 2000));
  assert.ok(checkPrices(2000, 2500));
});
test('search query: filters, defaults and errors', () => {
  const p = (s) => parseSearchQuery(new URLSearchParams(s));
  const ok = p('q=maroon sari&gender=Female&min_price=500&max_price=3000&color=Maroon&page=2&limit=10');
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.value, { q: 'maroon sari', gender: 'female', min_price: 500, max_price: 3000, color: 'maroon', page: 2, limit: 10 });
  assert.deepEqual(p('').value, { page: 1, limit: 20 });
  assert.ok(p('gender=alien').errors.length);
  assert.ok(p('min_price=abc').errors.length);
  assert.ok(p('min_price=900&max_price=100').errors.length);
  assert.ok(p('limit=500').errors.length);
  assert.ok(p('shop_id=nope').errors.length);
  assert.equal(p('in_stock=true').value.in_stock, true);
});
