'use client';
import { useState } from 'react';
import { bdt } from '../lib/stylist';

const PLANS = [{ m: 1, p: 1000, l: '1 mo' }, { m: 3, p: 2500, l: '3 mo' }, { m: 6, p: 5000, l: '6 mo' }];
const rate = p => (p < 500 ? 2 : p < 1000 ? 3 : 5);

export default function Sellers() {
  const [plan, setPlan] = useState(PLANS[1]);
  const [price, setPrice] = useState(1200);
  const save = plan.m * 1000 - plan.p;
  const p = Number(price) || 0, r = rate(p), fee = Math.round(p * r / 100);

  return (
    <section id="sellers" className="sec"><div className="wrap">
      <h2>Built for small businesses</h2>
      <p className="sub">Free to start. Upgrade when you want featured placement and full AI analytics.</p>
      <div className="plans">
        <article className="plan"><h3>Free</h3><div className="price">0 <small>BDT</small></div>
          <ul><li>Shop &amp; product listings</li><li>Order management &amp; chat</li><li>Basic sales analytics</li><li>Standard verification queue</li></ul>
          <a className="btn alt" href="#">Open free shop</a></article>
        <article className="plan pop"><span className="tag">Best value</span><h3>Premium</h3>
          <div className="seg">{PLANS.map(x => <button key={x.m} className={x === plan ? 'on' : ''} onClick={() => setPlan(x)}>{x.l}</button>)}</div>
          <div className="price">{plan.p.toLocaleString()} <small>BDT</small></div>
          <p className="save">{save > 0 ? `Save ${save.toLocaleString()} BDT vs monthly` : 'Pay monthly, cancel anytime'}</p>
          <ul><li>Featured placement</li><li>Full AI analytics &amp; demand gaps</li><li>Higher listing limits</li><li>Priority verification</li></ul>
          <a className="btn" href="#">Go Premium</a></article>
        <article className="plan calc"><h3>Commission calculator</h3>
          <label>Item price (BDT)<input type="number" min="0" value={price} onChange={e => setPrice(e.target.value)} /></label>
          <dl><dt>Commission rate</dt><dd>{r}%</dd><dt>Platform fee</dt><dd>{bdt(fee)}</dd><dt>You receive</dt><dd className="big">{bdt(p - fee)}</dd></dl>
          <p className="note">&lt;500: 2% · 500–999: 3% · 1,000+: 5%</p></article>
      </div>
      <div className="insights"><h3>What your analytics say</h3><ul>
        <li><b>Demand gap</b> Maroon saris: high search, few listings – good time to restock.</li>
        <li><b>Underperformer</b> Navy kurti has many views but few orders. Try a lower price or better photos.</li>
        <li><b>Price benchmark</b> Your three-piece is 12% above the category median.</li></ul></div>
    </div></section>
  );
}
