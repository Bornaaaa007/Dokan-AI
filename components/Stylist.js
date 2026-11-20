'use client';
import { useState } from 'react';
import { CATALOG, bdt, sum, buildOutfit, swapItem } from '../lib/stylist';

export default function Stylist() {
  const [occ, setOcc] = useState('wedding');
  const [budget, setBudget] = useState(5000);
  const [res, setRes] = useState(null);
  const [added, setAdded] = useState(false);
  const items = CATALOG[occ].items;

  const run = (b = budget) => { setAdded(false); setRes({ occ, budget: Number(b), ...buildOutfit(occ, Number(b)) }); };
  const total = res?.pick ? sum(res.occ, res.pick) : 0;
  const leftOut = res?.pick ? CATALOG[res.occ].items.filter((_, i) => res.pick[i] < 0).map(i => i.slot) : [];

  return (
    <section id="stylist" className="sec tint"><div className="wrap">
      <h2>Meet your AI stylist</h2>
      <p className="sub">Interactive demo with sample catalog data. Try a tiny budget, a huge one, or something in between.</p>
      <div className="demo grid2">
        <form className="panel" onSubmit={e => { e.preventDefault(); run(); }}>
          <label>Occasion
            <select value={occ} onChange={e => { setOcc(e.target.value); setRes(null); }}>
              {Object.entries(CATALOG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </label>
          <label>Total budget (BDT)
            <input type="number" min="0" value={budget} onChange={e => setBudget(e.target.value)} />
          </label>
          <div className="row g wrapx">
            {[100, 1500, 5000, 100000].map(b => (
              <button type="button" key={b} className="chip b" onClick={() => { setBudget(b); run(b); }}>{b.toLocaleString('en-IN')}</button>
            ))}
          </div>
          <button className="btn" type="submit">Build my outfit</button>
          <p className="note">Sandbox demo · no real payments</p>
        </form>

        <div className="panel out" aria-live="polite">
          {!res && <div className="msg">Pick an occasion and budget, then press <b>Build my outfit</b>.</div>}
          {res?.error && <div className="msg warn">{res.error}</div>}
          {res?.pick && <>
            {res.note && <div className="msg warn">{res.note}</div>}
            {res.pick.map((t, i) => t < 0 ? null : (
              <div className="item" key={i}>
                <i style={{ background: items[i].o[t].color }} />
                <div><b style={{ whiteSpace: 'normal' }}>{items[i].o[t].name}</b><small>{items[i].slot} · Sizes in stock · Verified seller</small></div>
                <b>{bdt(items[i].o[t].price)}</b>
                <button onClick={() => setRes({ ...res, pick: swapItem(res.occ, res.pick, i, res.budget) })}>Swap</button>
              </div>
            ))}
            {leftOut.length > 0 && <div className="msg warn">Left out to fit your budget: {leftOut.join(', ')}.</div>}
            <div className="tot"><span>Bundle total</span><span>{bdt(total)}</span></div>
            <div className="tot ok" style={{ border: 0, padding: 0 }}><span>Remaining</span><span>{bdt(res.budget - total)}</span></div>
            <button className="btn" onClick={() => setAdded(true)}>{added ? 'Added – split into one order per seller ✓' : 'Add bundle to cart'}</button>
          </>}
        </div>
      </div>
    </div></section>
  );
}
