'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useStore } from './Store';
import { PRODUCTS } from '../lib/data';
import { track } from '../lib/track';
import { bdt } from '../lib/stylist';
import { askStylist } from '../lib/stylistApi';

const OCCASIONS = [
  ['wedding', 'Wedding'],
  ['interview', 'Interview / formal'],
  ['eid', 'Eid'],
  ['party', 'Party'],
  ['casual', 'Casual'],
];
const AUDIENCES = [
  ['a young woman', 'Woman'],
  ['a man', 'Man'],
  ['a girl (child)', 'Girl (child)'],
  ['a boy (child)', 'Boy (child)'],
  ['an elderly woman', 'Elderly woman'],
  ['an elderly man', 'Elderly man'],
];
const GOOD_STATUS = ['ok'];

function swatch(colors) {
  const c = String((colors && colors[0]) || '').toLowerCase().replace(/[\s-]/g, '');
  return typeof CSS !== 'undefined' && c && CSS.supports('color', c) ? c : '#d9d9d9';
}

export default function Stylist() {
  const [occ, setOcc] = useState('wedding');
  const [who, setWho] = useState('a young woman');
  const [budget, setBudget] = useState(5000);
  const [data, setData] = useState(null);      // last response from the stylist
  const [conv, setConv] = useState(null);      // conversation id (the AI remembers earlier messages)
  const [alt, setAlt] = useState(0);           // which look is shown (0 = main, 1+ = alternatives)
  const [added, setAdded] = useState(false);
    const { add } = useStore();
  const [missing, setMissing] = useState(0);

  // Puts every item of the shown look into the real cart (matched by database id).
  const addBundle = () => {
    let skipped = 0;
    look.items.forEach((it) => {
      const p = PRODUCTS.find((x) => x.uuid === it.product_id);
      const size = (p && (p.sizes || []).find((s) => (it.sizes || []).includes(s))) || (it.sizes || [])[0] || (p && p.sizes[0]);
      if (!p || !size) { skipped++; return; }
      add(p.id, size);
      track('add_to_cart', p);
    });
    setMissing(skipped); setAdded(true);
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [chat, setChat] = useState('');

  const send = async (message, conversationId) => {
    setLoading(true); setError(''); setAdded(false);
    try {
      const d = await askStylist({ message, conversationId });
      setData(d); setConv(d.conversation_id); setAlt(0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Form: always starts a fresh conversation
  const run = (b = budget) => {
    const amount = Number(b);
    if (!amount || amount <= 0) { setError('Enter your budget in BDT, for example 5000.'); return; }
    send(`${occ} outfit for ${who}, budget ${amount} BDT`, null);
  };

  // Follow-up box: continues the same conversation
  const sendChat = (e) => {
    e.preventDefault();
    const m = chat.trim();
    if (!m || loading) return;
    setChat('');
    send(m, conv);
  };

  const bundle = data?.bundle;
  const looks = bundle
    ? [{ items: bundle.items, total: bundle.total, remaining: bundle.remaining }, ...(bundle.alternatives || [])]
    : [];
  const look = looks.length ? looks[alt % looks.length] : null;
  const sellers = look ? new Set(look.items.map((i) => i.shop_id)).size : 0;
  const leftOut = bundle?.left_out || [];
  const replyClass = data && !GOOD_STATUS.includes(data.status) ? 'msg warn' : 'msg';

  return (
    <section id="stylist" className="sec tint"><div className="wrap">
      <h2>Meet your AI stylist</h2>
      <p className="sub">Live AI stylist: it only suggests real in-stock products from verified sellers. Try a tiny budget, a huge one, or something in between.</p>
      <div className="demo grid2">
        <form className="panel" onSubmit={(e) => { e.preventDefault(); run(); }}>
          <label>Occasion
            <select value={occ} onChange={(e) => setOcc(e.target.value)}>
              {OCCASIONS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </label>
          <label>Who is it for?
            <select value={who} onChange={(e) => setWho(e.target.value)}>
              {AUDIENCES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </label>
          <label>Total budget (BDT)
            <input type="number" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} />
          </label>
          <div className="row g wrapx">
            {[100, 1500, 5000, 100000].map((b) => (
              <button type="button" key={b} className="chip b" disabled={loading}
                onClick={() => { setBudget(b); run(b); }}>{b.toLocaleString('en-IN')}</button>
            ))}
          </div>
          <button className="btn" type="submit" disabled={loading}>{loading ? 'Styling…' : 'Build my outfit'}</button>
        
        </form>

        <div className="panel out" aria-live="polite">
          {!data && !error && !loading && <div className="msg">Pick an occasion, who it is for and a budget, then press <b>Build my outfit</b>.</div>}
          {loading && <div className="msg">Your stylist is picking items…</div>}
          {error && <div className="msg warn">{error}</div>}

          {data && !loading && <>
            <div className={replyClass} style={{ whiteSpace: 'pre-line' }}>{data.reply}</div>

            {look && look.items.map((it) => (
              <div className="item" key={it.product_id}>
                <i style={{ background: swatch(it.colors) }} />
                <div>
                  <b style={{ whiteSpace: 'normal' }}>{it.name}</b>
                  <small>
                    {it.label} · {it.shop_name} · Sizes: {(it.sizes || []).join(', ') || 'n/a'}
                    {it.original_price ? <> · was {bdt(it.original_price)}</> : null}
                    {it.seller_flagged ? ' · ⚠ seller has a verified-complaint badge' : ' · Verified seller'}
                  </small>
                </div>
                <b>{bdt(it.price)}</b>
              </div>
            ))}

            {look && leftOut.length > 0 && alt === 0 && (
              <div className="msg warn">Left out: {leftOut.join(', ')}.</div>
            )}

            {look && <>
              <div className="tot"><span>Bundle total</span><span>{bdt(look.total)}</span></div>
              <div className="tot ok" style={{ border: 0, padding: 0 }}><span>Remaining</span><span>{bdt(look.remaining)}</span></div>
              {looks.length > 1 && (
                <button type="button" className="chip b" onClick={() => { setAlt((alt + 1) % looks.length); setAdded(false); }}>
                  Show another look ({(alt % looks.length) + 1}/{looks.length})
                </button>
              )}
                            {added
                ? <Link className="btn" href="/cart">Added ✓ View cart (splits into {sellers} order{sellers === 1 ? '' : 's'}, one per seller)</Link>
                : <button className="btn" type="button" onClick={addBundle}>Add bundle to cart</button>}
              {added && missing > 0 && <div className="msg warn">{missing} item(s) could not be added because they are not in the live shop.</div>}
            </>}

            {!look && data.min_required_total ? (
              <div className="tot"><span>Realistic starting price</span><span>{bdt(data.min_required_total)}</span></div>
            ) : null}
          </>}

          {data && (
            <form className="row g" onSubmit={sendChat} style={{ marginTop: 12 }}>
              <input
                value={chat} onChange={(e) => setChat(e.target.value)} disabled={loading}
                placeholder={data.ask ? 'Answer the stylist here…' : 'Ask for changes, e.g. "make it maroon" or "my budget is 8000"'}
                style={{ flex: 1 }}
              />
              <button className="btn" type="submit" disabled={loading || !chat.trim()}>Send</button>
            </form>
          )}
        </div>
      </div>
    </div></section>
  );
}