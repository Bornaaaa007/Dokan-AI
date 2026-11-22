import Link from 'next/link';
import { shopOf, bdt } from '../lib/data';
import ProductArt from './ProductArt';

export const ShopBadge = ({ shop }) => <>{shop.verified && <span className="badge">✓ Verified</span>} {shop.fraud && <span className="badge bad">Verified complaints</span>}</>;
export function ProductCard({ p }) {
  const s = shopOf(p.shop);
  return (
    <Link href={`/product/${p.id}`} className="pcard">
      <div className="sw"><ProductArt p={p} />{s.premium && <span className="fl">Featured</span>}</div>
      <div className="bd"><h4>{p.name}</h4><b>{bdt(p.price)}</b><br /><small>{s.name} · ★ {s.rating}</small><br /><ShopBadge shop={s} /></div>
    </Link>
  );
}