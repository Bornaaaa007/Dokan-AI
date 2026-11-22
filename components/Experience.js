'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import ProductArt from './ProductArt';
import { PRODUCTS, bdt } from '../lib/data';

const P = (id) => PRODUCTS.find((p) => p.id === id);
const Row = ({ id }) => <div className="mini"><div className="thumb"><ProductArt p={P(id)} /></div><span>{P(id).name}<em>{bdt(P(id).price)}</em></span></div>;

const FLOWS = {
  Shopper: [
    ['Tell the stylist', 'Pick an occasion, who it is for and your budget – in Bangla or English.', <><div className="bub u">Wedding guest · 5,000 BDT</div><div className="bub a sm">Great! Looking for a full look in stock…</div></>],
    ['Get a complete look', 'Sari, shoes and jewelry from verified sellers, all within budget.', <><Row id={1} /><Row id={11} /><Row id={14} /><div className="tot"><span>Total</span><span>4,000 BDT</span></div></>],
    ['Check out your way', 'Pay with bKash, Nagad, card or cash on delivery. One order per seller.', <><div className="opts">{['bKash', 'Nagad', 'Card', 'COD'].map((m, i) => <button key={m} className={i ? '' : 'on'}>{m}</button>)}</div><div className="msg">Funds are held in escrow until you confirm delivery.</div></>],
    ['Track and confirm', 'Follow each order and confirm delivery – or report a problem.', <><div className="rowb"><b>Order #1002</b><span className="badge pend">Shipped</span></div><div className="trk">{[1, 1, 1, 1, 0].map((d, i) => <i key={i} className={d ? 'd' : ''} />)}</div><button className="btn sm2">Confirm delivery</button></>],
  ],
  Seller: [
    ['Open your shop', 'Set up in minutes. List products with sizes, photos and prices.', <><div className="rowb"><b>Nusrat Boutique</b><span className="badge">✓ Verified</span></div><Row id={2} /><Row id={3} /></>],
    ['Receive orders', 'New orders arrive with the customer details; update status in one tap.', <><div className="rowb"><b>#1001 · Rafi A.</b><span className="badge pend">Placed</span></div><button className="btn sm2">Mark Accepted</button></>],
    ['See what to restock', 'AI insights show demand gaps and what is not selling – in plain language.', <div className="insights" style={{ padding: 0, border: 0, margin: 0 }}><ul><li><b>Demand gap</b> Maroon saris searched 41 times.</li><li><b>Tip</b> Lower navy kurti price by 10%.</li></ul></div>],
    ['Get paid safely', 'Escrow releases your payout when the customer confirms delivery.', <><div className="kpis" style={{ margin: 0 }}><div><b>12,450</b><span>Gross (BDT)</span></div><div><b>11,830</b><span>Net payout</span></div></div></>],
  ],
};

export default function Experience() {
  const [role, setRole] = useState('Shopper'), [i, setI] = useState(0), [auto, setAuto] = useState(true);
  useEffect(() => { if (!auto) return; const t = setInterval(() => setI((x) => (x + 1) % 4), 4500); return () => clearInterval(t); }, [auto]);
  const steps = FLOWS[role];
  return (
    <section id="experience" className="sec"><div className="wrap">
      <h2>See the experience</h2>
      <p className="sub">A quick walk-through of how Dokan AI feels for shoppers and for sellers.</p>
      <div className="seg" style={{ maxWidth: 260, marginBottom: 24 }}>{Object.keys(FLOWS).map((r) => <button key={r} className={r === role ? 'on' : ''} onClick={() => { setRole(r); setI(0); }}>{r}</button>)}</div>
      <div className="grid2 exp">
        <ol className="xsteps">{steps.map(([h, t], n) => <li key={h} className={n === i ? 'on' : ''}><button onClick={() => { setI(n); setAuto(false); }}><span>{n + 1}</span><div><b>{h}</b><p>{t}</p></div></button></li>)}</ol>
        <div className="phone"><div className="rowb sm"><b>Dokan AI</b><span>{i + 1} / 4</span></div>{steps[i][2]}</div>
      </div>
      <div style={{ marginTop: 28 }} className="row g wrapx"><Link className="btn" href="/shop">Start shopping</Link><Link className="btn alt" href="/seller">Explore the seller hub</Link></div>
    </div></section>
  );
}