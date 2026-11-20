'use client';
import { useState } from 'react';
import { PRODUCTS, shopOf } from '../../lib/data';
import { ProductCard } from '../../components/ui';

export default function Shop() {
  const [q, setQ] = useState(''), [g, setG] = useState(''), [t, setT] = useState(''), [max, setMax] = useState(''), [sort, setSort] = useState('feat');
  let list = PRODUCTS.filter((p) => (!q || (p.name + p.cat + p.color + p.occasion).toLowerCase().includes(q.toLowerCase())) && (!g || p.gender === g) && (!t || p.type === t) && (!max || p.price <= +max));
  const rank = (p) => (shopOf(p.shop).premium ? 0 : 1) + (shopOf(p.shop).fraud ? 5 : 0);
  list = [...list].sort((a, b) => (sort === 'low' ? a.price - b.price : sort === 'high' ? b.price - a.price : rank(a) - rank(b)));
  return (
    <div className="wrap page"><h1>Shop</h1><p className="sub">Affordable fashion from verified small sellers.</p>
      <div className="toolbar">
        <input type="search" placeholder="Search sari, kurti, maroon…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={g} onChange={(e) => setG(e.target.value)}><option value="">All shoppers</option>{['Women', 'Men', 'Children', 'Elderly'].map((x) => <option key={x}>{x}</option>)}</select>
        <select value={t} onChange={(e) => setT(e.target.value)}><option value="">All types</option>{['clothing', 'jewelry', 'shoes', 'accessories'].map((x) => <option key={x}>{x}</option>)}</select>
        <input type="number" placeholder="Max price" value={max} onChange={(e) => setMax(e.target.value)} />
        <select value={sort} onChange={(e) => setSort(e.target.value)}><option value="feat">Featured</option><option value="low">Price: low</option><option value="high">Price: high</option></select>
      </div>
      {list.length ? <div className="pgrid">{list.map((p) => <ProductCard key={p.id} p={p} />)}</div> : <div className="box">No match found. Try the <a href="/stylist">AI stylist</a>.</div>}
    </div>
  );
}
