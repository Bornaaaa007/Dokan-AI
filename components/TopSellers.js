'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';

// Home page section: this month's top sellers from GET /api/top-sellers (public). Hidden if there are none.
export default function TopSellers() {
  const [shops, setShops] = useState([]);
  useEffect(() => { api('/top-sellers').then((r) => setShops(r.data.shops || [])).catch(() => {}); }, []);
  if (!shops.length) return null;
  return (
    <section className="sec"><div className="wrap">
      <h2>Top sellers this month</h2>
      <p className="sub">Ranked by completed orders in the last 30 days.</p>
      <div className="cards4 three">{shops.slice(0, 3).map((s) => (
        <article key={s.shop_id}><div className="ic">🏆</div><h3>#{s.rank} {s.name}</h3>
          <p><span className="badge">✓ Verified</span></p>
          <Link className="btn alt sm2" style={{ marginTop: 12 }} href="/shop">Browse products</Link></article>
      ))}</div>
    </div></section>
  );
}