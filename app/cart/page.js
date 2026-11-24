'use client';
import { useState } from 'react';
import Link from 'next/link';
import { PRODUCTS, shopOf, bdt, DELIVERY } from '../../lib/data';
import { useStore, itemsTotal } from '../../components/Store';
import { useAuth } from '../../components/AuthProvider';
import RequireAuth from '../../components/RequireAuth';
import { supabase } from '../../lib/supabaseClient';

const GATEWAY = { bKash: 'bkash', Nagad: 'nagad', Card: 'card', COD: 'bkash' }; // COD: only the delivery charge is paid online
const MAX_QTY = 10;
const lineKey = (i) => `${i.pid}|${i.size}`;

// Calls our own backend with the logged-in user's token.
async function api(path, body) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, status: 401, json: { error: { message: 'Please log in again.' } } };
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  return { ok: res.ok, status: res.status, json: await res.json().catch(() => ({})) };
}
const errMsg = (r, fallback) => r.json?.error?.message || fallback;

function CartInner() {
  const { cart, add, remove } = useStore();
  const { profile } = useAuth();
  const [method, setMethod] = useState('bKash'), [outcome, setOutcome] = useState('success');
  const [addr, setAddr] = useState({ name: profile?.name || '', phone: profile?.phone || '', district: 'Dhaka', line: '' });
  const [colors, setColors] = useState({}), [askColor, setAskColor] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [results, setResults] = useState([]);

  const lines = cart.map((i) => ({ ...i, p: PRODUCTS.find((x) => x.id === i.pid) })).filter((i) => i.p);
  const groups = {};
  lines.forEach((i) => { (groups[i.p.shop] ||= []).push(i); });
  const n = Object.keys(groups).length;
  const total = itemsTotal(lines) + n * DELIVERY;
  const dueNow = method === 'COD' ? n * DELIVERY : total;
  const set = (k) => (e) => setAddr({ ...addr, [k]: e.target.value });

  const payOrder = async (order, shopName, gw, out) => {
    const r = await api(`/api/orders/${order.id}/pay`, { gateway: gw, outcome: out });
    const status = r.status === 200 ? 'paid' : r.status === 202 ? 'pending' : r.status === 402 ? 'failed' : 'error';
    return {
      shop: shopName, orderId: order.id, gateway: gw, status,
      due: r.json?.data?.order?.amount_due_online ?? order.amount_due_online,
      message: status === 'error' ? errMsg(r, 'Payment could not be processed.') : '',
    };
  };

  const checkout = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    if (lines.some((i) => !i.p.uuid)) { setBusy(false); return setError('Some items are sample data and cannot be ordered. Remove them and add live products.'); }
    const address = { name: addr.name.trim(), phone: addr.phone.trim(), line1: addr.line.trim(), city: addr.district };
    const done = [];
    for (const [sid, items] of Object.entries(groups)) {           // one order per shop
      const shop = shopOf(+sid);
      const created = await api('/api/orders', {
        payment_method: method === 'COD' ? 'cod' : 'sandbox',
        delivery_address: address,
        items: items.map((i) => ({ product_id: i.p.uuid, size: i.size, qty: i.qty, ...(colors[lineKey(i)] ? { color: colors[lineKey(i)] } : {}) })),
      });
      if (!created.ok) {
        if (created.json?.error?.code === 'color_required') setAskColor(true);
        const code = created.json?.error?.code;
        const gone = ['out_of_stock', 'product_not_found', 'variant_unavailable'].includes(code);
        done.push({
          shop: shop.name, status: 'error',
          message: errMsg(created, 'This order could not be placed.') + (gone ? ' Nothing was charged. Remove that item or pick another size, then try again. The AI Stylist can rebuild your look with items that are still in stock.' : ''),
        });
        continue;                                                   // these items stay in the cart
      }
      const order = created.json.data;
      items.forEach((i) => remove(i.pid, i.size));                  // order exists, so take it out of the cart
      done.push(await payOrder(order, shop.name, GATEWAY[method], outcome));
    }
    setResults(done); setBusy(false);
  };

  const retry = async (r, idx) => {
    setBusy(true);
    const again = await payOrder({ id: r.orderId, amount_due_online: r.due }, r.shop, r.gateway, 'success');
    setResults((all) => all.map((x, k) => (k === idx ? again : x)));
    setBusy(false);
  };

  if (!lines.length && !results.length) return <div className="wrap page"><h1>Your cart is empty</h1><Link className="btn" href="/shop">Browse products</Link></div>;

  return (
    <div className="wrap page">
      <div className="banner" style={{ borderRadius: 10, marginBottom: 20 }}>Sandbox: no real payment is taken on this site.</div>
      {results.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h1>Order summary</h1>
          {results.map((r, i) => (
            <div className="box rowb" key={i}>
              <div><b>{r.shop}</b>{r.orderId && <span className="sm"> · Order {String(r.orderId).slice(0, 8).toUpperCase()}</span>}
                <p className="sm" style={{ margin: '4px 0 0' }}>
                  {r.status === 'paid' && `Paid ${bdt(r.due)} – held safely until you confirm delivery.`}
                  {r.status === 'pending' && 'Payment is pending. You can retry below.'}
                  {r.status === 'failed' && 'Payment failed. Your order is saved; retry the payment.'}
                  {r.status === 'error' && r.message}
                </p></div>
              <span className="row g">
                <span className={`badge ${r.status === 'paid' ? '' : r.status === 'pending' ? 'pend' : 'bad'}`}>{r.status}</span>
                {(r.status === 'failed' || r.status === 'pending') && <button className="btn sm2" disabled={busy} onClick={() => retry(r, i)}>Retry payment</button>}
              </span>
            </div>
          ))}
          <Link className="btn alt" href="/orders">View my orders</Link>
        </div>
      )}

      {lines.length > 0 && <>
        <h1>Cart &amp; checkout</h1><p className="sub">Items from different sellers become separate orders.</p>
        <div className="two">
          <div>{Object.entries(groups).map(([sid, items]) => (
            <div className="box" key={sid}><h3>Order from {shopOf(+sid).name}</h3>
              {items.map((i) => (
                <div className="rowb" key={lineKey(i)} style={{ padding: '8px 0' }}>
                  <span>{i.p.name} <span className="sm">({i.size})</span>
                    {askColor && i.p.colors?.length > 1 && <select style={{ marginLeft: 8 }} value={colors[lineKey(i)] || ''} onChange={(e) => setColors({ ...colors, [lineKey(i)]: e.target.value })}><option value="">Colour…</option>{i.p.colors.map((c) => <option key={c}>{c}</option>)}</select>}
                  </span>
                  <span className="row g">
                    <button className="ghost" type="button" onClick={() => (i.qty > 1 ? add(i.pid, i.size, -1) : remove(i.pid, i.size))}>−</button>
                    <b>{i.qty}</b>
                    <button className="ghost" type="button" disabled={i.qty >= MAX_QTY} onClick={() => add(i.pid, i.size, 1)}>+</button>
                    <span style={{ minWidth: 90, textAlign: 'right' }}>{bdt(i.p.price * i.qty)}</span>
                    <button className="ghost" type="button" aria-label="Remove" onClick={() => remove(i.pid, i.size)}>✕</button>
                  </span>
                </div>))}
              <p className="sm">Delivery {bdt(DELIVERY)}</p></div>))}</div>

          <form className="box form wide" onSubmit={checkout}>
            <h3>Delivery address</h3>
            <div className="f2"><input required placeholder="Full name" value={addr.name} onChange={set('name')} /><input required placeholder="Phone (01XXXXXXXXX)" pattern="01[0-9]{9}" value={addr.phone} onChange={set('phone')} /></div>
            <select value={addr.district} onChange={set('district')}>{['Dhaka', 'Chattogram', 'Comilla', 'Sylhet', 'Rajshahi', 'Khulna'].map((d) => <option key={d}>{d}</option>)}</select>
            <input required placeholder="Upazila, area, house / road" value={addr.line} onChange={set('line')} />
            <h3>Payment</h3>
            <div className="opts">{['bKash', 'Nagad', 'Card', 'COD'].map((m) => <button type="button" key={m} className={method === m ? 'on' : ''} onClick={() => setMethod(m)}>{m === 'COD' ? 'Cash on Delivery' : m}</button>)}</div>
            {method === 'COD' && <p className="sm">For COD you pay the delivery charge ({bdt(n * DELIVERY)}) online first; the item price is paid in cash to the courier.</p>}
            <label className="sm">Demo payment result
              <select value={outcome} onChange={(e) => setOutcome(e.target.value)}><option value="success">Success</option><option value="failure">Failure</option><option value="pending">Pending</option></select></label>
            <p className="sm">Funds are held in escrow until you confirm delivery or 48 hours pass.</p>
            <div className="tot"><span>Total</span><span>{bdt(total)}</span></div>
            {error && <p className="err">{error}</p>}
            <button className="btn" disabled={busy}>{busy ? 'Placing your order…' : `Pay ${bdt(dueNow)}`}</button>
          </form>
        </div>
      </>}
    </div>
  );
}

export default function Cart() {
  return <RequireAuth role="customer"><CartInner /></RequireAuth>;
}