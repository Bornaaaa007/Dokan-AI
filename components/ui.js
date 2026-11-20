import Link from 'next/link';
import { COLORS, shopOf, bdt } from '../lib/data';

export const ShopBadge = ({ shop }) => <>{shop.verified && <span className="badge">✓ Verified</span>} {shop.fraud && <span className="badge bad">Verified complaints</span>}</>;
export function ProductCard({ p }) {
  const s = shopOf(p.shop);
  return (
    <Link href={`/product/${p.id}`} className="pcard">
      <div className="sw" style={{ background: `linear-gradient(135deg,${COLORS[p.color]},${COLORS[p.color]}99)` }}>{s.premium && <span className="fl">Featured</span>}</div>
      <div className="bd"><h4>{p.name}</h4><b>{bdt(p.price)}</b><br /><small>{s.name} · ★ {s.rating}</small><br /><ShopBadge shop={s} /></div>
    </Link>
  );
}
