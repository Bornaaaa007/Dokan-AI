import Link from 'next/link';
import { shopOf, bdt } from '../lib/data';
import ProductArt from './ProductArt';

export const ShopBadge = ({ shop }) => <>{shop.verified && <span className="badge">✓ Verified</span>} {shop.fraud && <span className="badge bad">Verified complaints</span>}</>;

// Real photo when the product has one, otherwise the drawn placeholder.
export function ProductPhoto({ p }) {
  if (!p.image) return <ProductArt p={p} />;
  return <img src={p.image} alt={p.name} loading="lazy" style={{ width: '100%', height: '100%', minHeight: 237, objectFit: 'cover', display: 'block' }} />;
}

export function ProductCard({ p }) {
  const s = shopOf(p.shop);
  return (
    <Link href={`/product/${p.id}`} className="pcard">
      <div className="sw"><ProductPhoto p={p} /></div>
      <div className="bd"><h4>{p.name}</h4><b>{bdt(p.price)}</b>{p.oldPrice && <> <small style={{ textDecoration: 'line-through' }}>{bdt(p.oldPrice)}</small></>}<br /><small>{s.name} · ★ {s.rating}</small><br /><ShopBadge shop={s} />
        <button type="button" className="btn" style={{ marginTop: 10, width: '100%' }}>Choose size</button></div>
    </Link>
  );
}