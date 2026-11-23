'use client';
import { useState } from 'react';
import Link from 'next/link';

const PLANS = [{ m: 1, p: 1000, l: '1 mo' }, { m: 3, p: 2500, l: '3 mo' }, { m: 6, p: 5000, l: '6 mo' }];

export default function Sellers() {
  const [plan, setPlan] = useState(PLANS[1]);
  const save = plan.m * 1000 - plan.p;

  return (
    <section id="sellers" className="sec"><div className="wrap">
      <h2>Built for small businesses</h2>
      <p className="sub">Free to start. Upgrade when you want featured placement and full AI analytics.</p>
      <div className="plans">
        <article className="plan"><h3>Free</h3><div className="price">0 <small>BDT</small></div>
          <ul><li>Shop &amp; product listings</li><li>Order management &amp; earnings ledger</li><li>Basic sales analytics</li></ul>
          <Link className="btn alt" href="/seller">Open free shop</Link></article>
        <article className="plan pop"><span className="tag">Best value</span><h3>Premium</h3>
          <div className="seg">{PLANS.map(x => <button key={x.m} className={x === plan ? 'on' : ''} onClick={() => setPlan(x)}>{x.l}</button>)}</div>
          <div className="price">{plan.p.toLocaleString()} <small>BDT</small></div>
          <p className="save">{save > 0 ? `Save ${save.toLocaleString()} BDT vs monthly` : 'Pay monthly, cancel anytime'}</p>
          <ul><li>Featured placement</li><li>Shown first in search results</li><li>Full AI analytics &amp; demand gaps</li></ul>
          <Link className="btn" href="/seller">Go Premium</Link></article>
      </div>
      <div className="insights"><h3>Example insights (sample data)</h3><p className="sm">Premium shops see real numbers for their own shop.</p><ul>
        <li><b>Demand gap</b> Maroon saris: high search, few listings – good time to restock.</li>
        <li><b>Underperformer</b> Navy kurti has many views but few orders. Try a lower price or better photos.</li>
        <li><b>Price benchmark</b> Your three-piece is 12% above the category median.</li></ul></div>
    </div></section>
  );
}