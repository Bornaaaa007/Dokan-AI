'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { track } from '../../../lib/track';
import { PRODUCTS, shopOf, bdt } from '../../../lib/data';
import ProductArt from '../../../components/ProductArt';
import { ProductCard, ShopBadge } from '../../../components/ui';
import { useStore } from '../../../components/Store';
import ProductReviews from '../../../components/ProductReviews';

export default function Product() {
  const { id } = useParams(), r = useRouter(), { add } = useStore();
  const p = PRODUCTS.find((x) => x.id === +id), [size, setSize] = useState('');
  useEffect(() => { track('view', p); }, [p?.uuid]);
  if (!p) return <div className="wrap page">Product not found.</div>;
  const s = shopOf(p.shop);
  return (
    <div className="wrap page">
      <div className="two">
        <div className="sw big"><ProductArt p={p} /></div>
        <div>
          <span className="chip">{p.gender} · {p.cat} · {p.occasion}</span><h1 style={{ marginTop: 10 }}>{p.name}</h1>
          <div className="price" style={{ fontSize: 34 }}>{bdt(p.price)}</div><p className="sub">{p.desc}</p>
          <b>Size</b><div className="opts" style={{ margin: '8px 0 18px' }}>{p.sizes.map((x) => <button key={x} className={size === x ? 'on' : ''} onClick={() => setSize(x)}>{x}</button>)}</div>
          <div className="row g" style={{ justifyContent: 'flex-start' }}>
            <button className="btn" disabled={!size} style={{ opacity: size ? 1 : .5 }} onClick={() => { add(p.id, size); track('add_to_cart', p); r.push('/cart'); }}>{size ? 'Add to cart' : 'Select a size'}</button>
            <button className="btn alt" disabled={!size} onClick={() => { add(p.id, size); track('add_to_cart', p); }}>Add &amp; keep shopping</button>
          </div>
          <div className="box" style={{ marginTop: 20 }}>
            <h3>{s.name} <ShopBadge shop={s} /></h3><p className="sm">{s.city}</p>
            {s.fraud && <p className="sm" style={{ color: '#b3261e' }}>⚠ This seller has an admin-verified complaint. Review before buying.</p>}
            <p className="sm"><b>Return &amp; exchange:</b> {s.policy}</p><p className="sm"><b>Delivery:</b> Courier, 2–5 days · 80 BDT</p>
          </div>
        </div>
      </div>
      <h3 id="reviews" style={{ margin: '34px 0 12px', scrollMarginTop: 80 }}>Reviews</h3>
      <ProductReviews product={p} />
      <h3 style={{ margin: '30px 0 12px' }}>More from this shop</h3>
      <div className="pgrid">{PRODUCTS.filter((x) => x.shop === p.shop && x.id !== p.id).slice(0, 4).map((x) => <ProductCard key={x.id} p={x} />)}</div>
    </div>
  );
}