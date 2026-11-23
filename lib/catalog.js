// Loads shops + products from Supabase and puts them into the SAME arrays the app already uses
// (SHOPS and PRODUCTS in lib/data.js), in the SAME shape. So the cart, product page and
// ProductCard keep working. Ids stay numbers (1, 2, 3...); the real database id is in p.uuid / s.uuid.
// If the database can't be reached, the old hardcoded data stays.
import { SHOPS, PRODUCTS } from './data';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

async function get(path) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

export function shapeCatalog(shopRows, productRows, badgedOwnerIds) {
  const shops = shopRows
    .filter((s) => s.verification_status === 'verified')
    .map((s, i) => ({
      id: i + 1, uuid: s.id, name: s.name, city: s.city || 'Bangladesh',
      rating: 4.5, followers: 0,                       // no ratings/followers in the database yet
      verified: true, fraud: badgedOwnerIds.has(s.owner_id), premium: s.plan === 'premium',
      policy: s.return_policy || 'Ask the seller about returns and exchanges.',
    }));
  const shopNo = new Map(shops.map((s) => [s.uuid, s.id]));

  const products = productRows
    .filter((p) => p.status === 'active' && shopNo.has(p.shop_id))
    .map((p) => {
      const variants = Array.isArray(p.variants) ? p.variants : [];
      const stock = variants.reduce((t, v) => t + (v.stock > 0 ? v.stock : 0), 0);
      const sizes = [...new Set(variants.filter((v) => v.stock > 0).map((v) => v.size))];
      const price = p.discount_price ?? p.price;
      return {
        p, stock, sizes, price,
      };
    })
    .filter((x) => x.stock > 0)                         // out-of-stock products are not listed
    .map(({ p, stock, sizes, price }, i) => ({
      id: i + 1, uuid: p.id, shopUuid: p.shop_id,
      name: p.name,
      cat: cap(p.custom_category || p.category),
      type: p.category,
      gender: p.age_group === 'child' ? 'Children' : p.age_group === 'elderly' ? 'Elderly' : p.gender === 'male' ? 'Men' : 'Women',
      unisex: p.gender === 'unisex',
      color: (p.colors && p.colors[0]) || '',
      colors: p.colors || [],
      price, oldPrice: p.discount_price != null && p.discount_price < p.price ? p.price : null,
      shop: shopNo.get(p.shop_id),
      occasion: cap((p.occasion_tags && p.occasion_tags[0]) || ''),
      tags: p.occasion_tags || [],
      sizes, stock,
      image: (p.image_urls && p.image_urls[0]) || null,
      img: (p.image_urls && p.image_urls[0]) || null,   // ProductArt uses p.img for the real photo
      desc: p.description || `${p.name} from a verified small seller. Delivery by courier across Bangladesh.`,
    }));
  return { shops, products };
}

let loading = null;
// force = true fetches again (the shop page does this every time it opens).
export function loadCatalog(force = false) {
  if (!URL || !KEY) return Promise.resolve(false);
  if (loading && !force) return loading;
  loading = (async () => {
    try {
      const [shopRows, productRows, badges] = await Promise.all([
        get('shops?select=id,owner_id,name,city,verification_status,plan,return_policy'),
        get('products?select=*&status=eq.active&order=created_at.asc,id.asc&limit=1000'),
        get('badges?select=user_id&status=eq.active'),
      ]);
      const { shops, products } = shapeCatalog(shopRows, productRows, new Set(badges.map((b) => b.user_id)));
      if (!products.length) return false;
      SHOPS.splice(0, SHOPS.length, ...shops);
      PRODUCTS.splice(0, PRODUCTS.length, ...products);
      return true;
    } catch (e) {
      console.error('Could not load catalog, using built-in sample data:', e);
      loading = null;
      return false;
    }
  })();
  return loading;
}