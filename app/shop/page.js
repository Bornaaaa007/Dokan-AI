'use client';
import { useEffect, useState } from 'react';
import { PRODUCTS, shopOf } from '../../lib/data';
import { loadCatalog } from '../../lib/catalog';
import { ProductCard } from '../../components/ui';

const PER_PAGE = 20;

export default function Shop() {
  const [q, setQ] = useState(''), [g, setG] = useState(''), [t, setT] = useState(''), [max, setMax] = useState(''), [sort, setSort] = useState('def');
  const [page, setPage] = useState(1);
  const [, setTick] = useState(0);
  // Fetch the newest products from the database every time the shop page opens.
  useEffect(() => { loadCatalog(true).then((ok) => { if (ok) setTick((n) => n + 1); }); }, []);
  // Go back to page 1 whenever the search, filters or sort change.
  useEffect(() => { setPage(1); }, [q, g, t, max, sort]);

  let list = PRODUCTS.filter((p) => (!q || (p.name + p.cat + p.color + p.occasion + (p.tags || []).join(' ')).toLowerCase().includes(q.toLowerCase())) && (!g || p.gender === g || p.unisex) && (!t || p.type === t) && (!max || p.price <= +max));
  const fraud = (p) => (shopOf(p.shop)?.fraud ? 5 : 0);
  const premium = (p) => (shopOf(p.shop)?.premium ? 0 : 1);
  // PRODUCTS is loaded oldest first, so a higher id means a newer product (shown at the bottom).
  list = [...list].sort((a, b) =>
    sort === 'low' ? a.price - b.price
    : sort === 'high' ? b.price - a.price
    : sort === 'feat' ? (premium(a) + fraud(a)) - (premium(b) + fraud(b)) || a.id - b.id
    : fraud(a) - fraud(b) || a.id - b.id);

  // Pagination
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const cur = Math.min(page, pages);
  const start = (cur - 1) * PER_PAGE;
  const visible = list.slice(start, start + PER_PAGE);
  const goTo = (n) => {
    setPage(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const off = { opacity: 0.45, cursor: 'not-allowed', pointerEvents: 'none' };

  return (
    <div className="wrap page"><h1>Shop</h1><p className="sub">Affordable fashion from verified small sellers.</p>
      <div className="toolbar">
        <input type="search" placeholder="Search sari, kurti, maroon…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={g} onChange={(e) => setG(e.target.value)}><option value="">All shoppers</option>{['Women', 'Men', 'Children', 'Elderly'].map((x) => <option key={x}>{x}</option>)}</select>
        <select value={t} onChange={(e) => setT(e.target.value)}><option value="">All types</option>{['clothing', 'jewelry', 'shoes', 'accessories'].map((x) => <option key={x}>{x}</option>)}</select>
        <input type="number" placeholder="Max price" value={max} onChange={(e) => setMax(e.target.value)} />
        <select value={sort} onChange={(e) => setSort(e.target.value)}><option value="def">Default</option><option value="feat">Premium first</option><option value="low">Price: low</option><option value="high">Price: high</option></select>
      </div>
      {list.length ? (
        <>
          <p className="sm" style={{ margin: '0 0 14px' }}>Showing {start + 1}–{start + visible.length} of {list.length} products</p>
          <div className="pgrid">{visible.map((p) => <ProductCard key={p.id} p={p} />)}</div>
          {pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 32, flexWrap: 'wrap' }}>
              <button type="button" className="btn alt" style={cur === 1 ? off : undefined} disabled={cur === 1} onClick={() => goTo(cur - 1)}>← Previous</button>
              <span className="sm">Page <b>{cur}</b> of <b>{pages}</b></span>
              <button type="button" className="btn" style={cur === pages ? off : undefined} disabled={cur === pages} onClick={() => goTo(cur + 1)}>Next →</button>
            </div>
          )}
        </>
      ) : <div className="box">No match found. Try the <a href="/stylist">AI stylist</a>.</div>}
    </div>
  );
}