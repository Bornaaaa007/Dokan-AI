'use client';
import { useState } from 'react';
import { PRODUCTS, SHOPS, bdt, commissionRate, STATUS, DELIVERY } from '../../lib/data';
import { useStore, itemsTotal } from '../../components/Store';

const NEXT = { Placed: 'Accepted', Accepted: 'Packed', Packed: 'Shipped' };
export default function Seller() {
  const shop = SHOPS[0], { orders, setStatus } = useStore();
  const [tab, setTab] = useState('Overview'), [mine, setMine] = useState(PRODUCTS.filter((p) => p.shop === 1));
  const [f, setF] = useState({ name: '', cat: '', price: '', stock: '' }), [premium, setPremium] = useState(true);
  const my = orders.filter((o) => o.shopId === 1), gross = my.reduce((s, o) => s + itemsTotal(o.items), 0);
  const fee = my.reduce((s, o) => s + itemsTotal(o.items) * commissionRate(itemsTotal(o.items)) / 100, 0);
  const add = (e) => { e.preventDefault(); setMine([{ id: Date.now(), name: f.name, cat: f.cat, price: +f.price, stock: +f.stock }, ...mine]); setF({ name: '', cat: '', price: '', stock: '' }); };
  return (
    <div className="wrap page"><div className="rowb"><div><h1>{shop.name}</h1><span className="badge">✓ Verified</span> <span className="badge">{premium ? 'Premium' : 'Free plan'}</span></div><button className="btn alt" onClick={() => setPremium(!premium)}>{premium ? 'Preview Free plan' : 'Upgrade to Premium'}</button></div>
      <div className="tabs">{['Overview', 'Products', 'Orders', 'Analytics', 'Shop profile'].map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
      {tab === 'Overview' && <><div className="kpis"><div><b>{my.length}</b><span>Orders</span></div><div><b>{bdt(gross)}</b><span>Gross sales</span></div><div><b>{bdt(fee)}</b><span>Platform commission</span></div><div><b>{bdt(gross - fee)}</b><span>Net payout (escrow released on delivery)</span></div><div><b>★ {shop.rating}</b><span>Shop rating</span></div></div>
        <div className="box"><h3>To do</h3><p className="sm">{my.filter((o) => o.status === 'Placed').length} new order(s) waiting · {mine.filter((p) => p.stock < 10).length} low-stock product(s)</p></div></>}
      {tab === 'Products' && <div className="two"><div className="tbl-w"><table className="tbl"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th></tr></thead><tbody>{mine.map((p) => <tr key={p.id}><td>{p.name}</td><td>{p.cat}</td><td>{bdt(p.price)}</td><td>{p.stock}</td></tr>)}</tbody></table></div>
        <form className="box form wide" onSubmit={add}><h3>Add product</h3><input required placeholder="Product name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /><input required placeholder="Custom category (e.g. Kurti)" value={f.cat} onChange={(e) => setF({ ...f, cat: e.target.value })} />
          <div className="f2"><input required type="number" placeholder="Price BDT" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /><input required type="number" placeholder="Stock" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} /></div>
          <label>Photos (up to 5)<input type="file" multiple accept="image/*" /></label>
          {f.price && <p className="sm">Commission {commissionRate(+f.price)}% · you receive {bdt(f.price * (1 - commissionRate(+f.price) / 100))}</p>}<button className="btn">Publish product</button></form></div>}
      {tab === 'Orders' && (my.length ? my.map((o) => <div className="box rowb" key={o.id}><div><b>#{o.id}</b> · {o.customer} · {o.method}<br /><span className="sm">{o.items.length} item(s) · {bdt(itemsTotal(o.items) + DELIVERY)} · {o.status}</span></div>{NEXT[o.status] ? <button className="btn sm2" onClick={() => setStatus(o.id, NEXT[o.status])}>Mark {NEXT[o.status]}</button> : <span className="badge">{o.status}</span>}</div>) : <div className="box">No orders yet.</div>)}
      {tab === 'Analytics' && <div className={premium ? '' : 'lock'}>{!premium && <div className="box">🔒 Full AI analytics are Premium. Showing basic stats only.</div>}
        <div className="kpis"><div><b>1,284</b><span>Views (30d)</span></div><div><b>3.4%</b><span>Conversion</span></div><div><b>Maroon sari</b><span>Best seller</span></div></div>
        {premium && <div className="insights box"><h3>AI insights</h3><ul><li><b>Demand gap</b> Customers searched “maroon sari” 41 times; stock only 2 listings.</li><li><b>Underperformer</b> Navy kurti: many views, few orders – try a lower price.</li><li><b>Price benchmark</b> Your three-piece is 12% above the category median.</li><li><b>Ask</b> “Which products should I restock for Eid?” (Bangla or English)</li></ul></div>}</div>}
      {tab === 'Shop profile' && <form className="form box wide"><input defaultValue={shop.name} /><input defaultValue="@nusrat.boutique (Facebook)" /><textarea defaultValue={shop.policy} /><p className="sm">Verification: NID ✓ · Social page ✓ · Payout account (bKash) ✓</p><button className="btn" type="button">Save profile</button></form>}
    </div>
  );
}
