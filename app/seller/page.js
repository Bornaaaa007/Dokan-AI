'use client';
import { useState, useEffect } from 'react';
import { PRODUCTS, SHOPS, bdt, commissionRate, STATUS, DELIVERY } from '../../lib/data';
import { useStore, itemsTotal } from '../../components/Store';
import { DEMO_SHOPS, DEMO_SHOP_KEY } from '../../lib/demoShops';

const NEXT = { Placed: 'Accepted', Accepted: 'Packed', Packed: 'Shipped' };
const pct = (r) => (r == null ? '—' : (r * 100).toFixed(1) + '%');

export default function Seller() {
  const shop = SHOPS[0], { orders, setStatus } = useStore();
  const [tab, setTab] = useState('Overview'), [mine, setMine] = useState(PRODUCTS.filter((p) => p.shop === 1));
  const [f, setF] = useState({ name: '', cat: '', price: '', stock: '' });
  const my = orders.filter((o) => o.shopId === 1), gross = my.reduce((s, o) => s + itemsTotal(o.items), 0);
  const fee = my.reduce((s, o) => s + itemsTotal(o.items) * commissionRate(itemsTotal(o.items)) / 100, 0);
  const add = (e) => { e.preventDefault(); setMine([{ id: Date.now(), name: f.name, cat: f.cat, price: +f.price, stock: +f.stock }, ...mine]); setF({ name: '', cat: '', price: '', stock: '' }); };

  // ---- Demo seller login + real analytics ----
  const [shopId, setShopId] = useState('');
  const [data, setData] = useState(null);
  const [aload, setAload] = useState(false);
  const [aerr, setAerr] = useState('');
  const [previewFree, setPreviewFree] = useState(false);

  useEffect(() => {
    let saved = '';
    try { saved = localStorage.getItem(DEMO_SHOP_KEY) || ''; } catch { /* storage blocked */ }
    setShopId(DEMO_SHOPS.some((s) => s.id === saved) ? saved : DEMO_SHOPS[0].id);
  }, []);

  useEffect(() => {
    if (!shopId) return;
    let off = false;
    setAload(true); setAerr('');
    fetch('/api/seller/analytics?shop_id=' + shopId)
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(j?.error?.message || 'Analytics request failed (' + r.status + ')');
        return j.data;
      })
      .then((d) => { if (!off) setData(d); })
      .catch((e) => { if (!off) { setData(null); setAerr(e.message); } })
      .finally(() => { if (!off) setAload(false); });
    return () => { off = true; };
  }, [shopId]);

  const pick = (id) => {
    setShopId(id); setPreviewFree(false); setData(null);
    try { localStorage.setItem(DEMO_SHOP_KEY, id); } catch { /* ignore */ }
  };
  const premium = !!data && !data.locked && !previewFree;
  const shopName = data?.shop?.name || DEMO_SHOPS.find((s) => s.id === shopId)?.name || shop.name;

  return (
    <div className="wrap page"><div className="rowb"><div><h1>{shopName}</h1><span className="badge">✓ Verified</span> <span className="badge">{data ? (premium ? 'Premium' : 'Free plan') : '…'}</span></div>
      <div>
        <label className="sm">Demo seller login{' '}
          <select value={shopId} onChange={(e) => pick(e.target.value)}>
            {DEMO_SHOPS.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.plan})</option>)}
          </select>
        </label>{' '}
        {data && !data.locked && <button className="btn alt" onClick={() => setPreviewFree(!previewFree)}>{previewFree ? 'Back to Premium view' : 'Preview Free plan'}</button>}
      </div></div>
      <div className="tabs">{['Overview', 'Products', 'Orders', 'Analytics', 'Shop profile'].map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
      {tab === 'Overview' && <><div className="kpis"><div><b>{my.length}</b><span>Orders</span></div><div><b>{bdt(gross)}</b><span>Gross sales</span></div><div><b>{bdt(fee)}</b><span>Platform commission</span></div><div><b>{bdt(gross - fee)}</b><span>Net payout (escrow released on delivery)</span></div><div><b>★ {shop.rating}</b><span>Shop rating</span></div></div>
        <div className="box"><h3>To do</h3><p className="sm">{my.filter((o) => o.status === 'Placed').length} new order(s) waiting · {mine.filter((p) => p.stock < 10).length} low-stock product(s)</p></div></>}
      {tab === 'Products' && <div className="two"><div className="tbl-w"><table className="tbl"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th></tr></thead><tbody>{mine.map((p) => <tr key={p.id}><td>{p.name}</td><td>{p.cat}</td><td>{bdt(p.price)}</td><td>{p.stock}</td></tr>)}</tbody></table></div>
        <form className="box form wide" onSubmit={add}><h3>Add product</h3><input required placeholder="Product name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /><input required placeholder="Custom category (e.g. Kurti)" value={f.cat} onChange={(e) => setF({ ...f, cat: e.target.value })} />
          <div className="f2"><input required type="number" placeholder="Price BDT" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /><input required type="number" placeholder="Stock" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} /></div>
          <label>Photos (up to 5)<input type="file" multiple accept="image/*" /></label>
          {f.price && <p className="sm">Commission {commissionRate(+f.price)}% · you receive {bdt(f.price * (1 - commissionRate(+f.price) / 100))}</p>}<button className="btn">Publish product</button></form></div>}
      {tab === 'Orders' && (my.length ? my.map((o) => <div className="box rowb" key={o.id}><div><b>#{o.id}</b> · {o.customer} · {o.method}<br /><span className="sm">{o.items.length} item(s) · {bdt(itemsTotal(o.items) + DELIVERY)} · {o.status}</span></div>{NEXT[o.status] ? <button className="btn sm2" onClick={() => setStatus(o.id, NEXT[o.status])}>Mark {NEXT[o.status]}</button> : <span className="badge">{o.status}</span>}</div>) : <div className="box">No orders yet.</div>)}
      {tab === 'Analytics' && <div>
        {aload && <div className="box">Loading analytics…</div>}
        {aerr && <div className="box">⚠ {aerr}</div>}
        {data && <>
          {!premium && <div className="box">🔒 Full AI analytics are Premium. Showing basic stats only.</div>}
          <div className="kpis">
            <div><b>{data.summary.views_30d.toLocaleString('en-US')}</b><span>Views (30d)</span></div>
            <div><b>{data.summary.purchases_30d}</b><span>Purchases (30d)</span></div>
            <div><b>{pct(data.summary.conversion)}</b><span>Conversion</span></div>
            <div><b>{data.summary.best_seller?.name || '—'}</b><span>Best seller</span></div>
            {data.shop.top_seller_rank && <div><b>#{data.shop.top_seller_rank}</b><span>Top seller rank</span></div>}
          </div>
          {premium && <>
            <div className="insights box"><h3>AI insights</h3>
              {data.insights.length === 0
                ? <p className="sm">Not enough data yet for tips. They appear once your products get views and sales.</p>
                : <ul>{data.insights.map((x, i) => <li key={i}><b>{x.title}</b> {x.text}</li>)}</ul>}
            </div>
            {data.best_products.length > 0 && <div className="box"><h3>Doing well</h3><ul>{data.best_products.map((p) => <li key={p.product_id}>{p.name}: {p.purchases_30d} sales from {p.views_30d} views ({pct(p.conversion)})</li>)}</ul></div>}
            {data.worst_products.length > 0 && <div className="box"><h3>Needs attention</h3><ul>{data.worst_products.map((p) => <li key={p.product_id}>{p.name}: {p.views_30d} views, {p.purchases_30d} sales</li>)}</ul></div>}
            {data.platform?.demand_gap?.length > 0 && <div className="box"><h3>What customers are looking for</h3><ul>{data.platform.demand_gap.map((d, i) => <li key={i}>“{d.name}”: {d.searches_30d} searches, {d.listings} in-stock listing{d.listings === 1 ? '' : 's'}</li>)}</ul></div>}
            {data.platform?.trending_categories?.length > 0 && <div className="box"><h3>Trending this week</h3><ul>{data.platform.trending_categories.map((t) => <li key={t.custom_category}>{t.custom_category}: {t.trending_products} trending product{t.trending_products === 1 ? '' : 's'}</li>)}</ul></div>}
          </>}
        </>}
      </div>}
      {tab === 'Shop profile' && <form className="form box wide"><input defaultValue={shop.name} /><input defaultValue="@nusrat.boutique (Facebook)" /><textarea defaultValue={shop.policy} /><p className="sm">Verification: NID ✓ · Social page ✓ · Payout account (bKash) ✓</p><button className="btn" type="button">Save profile</button></form>}
    </div>
  );
}