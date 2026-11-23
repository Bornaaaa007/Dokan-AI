import test from 'node:test';
import assert from 'node:assert/strict';
import { handleMyProducts } from './mine.mjs';

const seller = { id: 's1', name: 'Seller', roles: ['customer', 'seller'] };
const customer = { id: 'c1', name: 'Cust', roles: ['customer'] };
const shop = { id: 'shop1', owner_id: 's1', name: 'My Shop', city: 'Dhaka', verification_status: 'pending', plan: 'free', plan_expires_at: null };
const rows = [
  { id: 'p1', shop_id: 'shop1', name: 'Active', category: 'clothing', gender: 'female', age_group: 'adult', price: 1000, discount_price: null, variants: [{ size: 'M', color: '', stock: 2 }], status: 'active', created_at: '2026-01-02' },
  { id: 'p2', shop_id: 'shop1', name: 'Hidden', category: 'clothing', gender: 'female', age_group: 'adult', price: 900, discount_price: 800, variants: [{ size: 'M', color: '', stock: 0 }], status: 'hidden', created_at: '2026-01-01' },
];
const db = (shops = [shop]) => ({
  async getUserByToken(t) { return t === 'seller' ? seller : t === 'customer' ? customer : null; },
  async getShopsByOwner(id) { return id === 's1' ? shops : []; },
  async listProductsByShop(id) { assert.equal(id, 'shop1'); return rows; },
});
const call = (token, d = db()) => handleMyProducts(new Request('http://x/api/products/mine', { headers: token ? { authorization: 'Bearer ' + token } : {} }), {}, d);

test('needs sign-in', async () => assert.equal((await call(null)).status, 401));
test('customers get 403', async () => assert.equal((await call('customer')).status, 403));
test('seller without a shop gets an empty list', async () => {
  const r = await call('seller', db([]));
  assert.equal(r.status, 200); assert.deepEqual((await r.json()).data, []);
});
test('seller sees active AND hidden products with price_now', async () => {
  const r = await call('seller'); const j = await r.json();
  assert.equal(r.status, 200);
  assert.deepEqual(j.data.map((p) => p.status), ['active', 'hidden']);
  assert.equal(j.data[1].price_now, 800);
  assert.equal(j.data[0].in_stock, true);
});
