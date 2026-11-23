'use client';
// Real orders for the seller dashboard, with the fulfilment buttons.
// Needs: GET /api/orders?as=seller, PATCH /api/orders/:id/status
import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { bdt } from '../lib/data';

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const STEPS = ['placed', 'accepted', 'packed', 'shipped', 'delivered'];
// What the seller can do next. 'ship' etc. are the button texts.
const ACTION = {
  placed: { to: 'accepted', label: 'Accept order', needsPay: true },
  accepted: { to: 'packed', label: 'Mark packed', needsPay: true },
  packed: { to: 'shipped', label: 'Mark shipped', needsPay: true },
  shipped: { to: 'delivered', label: 'Mark delivered', needsPay: false },
};
const CANCELLABLE = ['placed', 'accepted', 'packed'];
const PAY = { pending: 'Payment pending', failed: 'Payment failed', held: 'Paid · held safely until delivery', released: 'Paid · released to you', refunded: 'Refunded' };
const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', year: 'numeric' });

export function useSellerOrders() {
  const [orders, setOrders] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState('');
  const load = useCallback(async () => {
    try { setOrders((await api('/orders?as=seller&limit=50')).data); }
    catch (e) { setError(e.message); setOrders((o) => o ?? []); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const setStatus = async (id, status) => {
    setBusy(id); setError('');
    try { await api(`/orders/${id}/status`, { method: 'PATCH', body: { status } }); }
    catch (e) { setError(e.message); }
    await load();
    setBusy('');
  };
  return { orders, error, busy, setStatus, reload: load };
}

export default function SellerOrders({ orders, error, busy, setStatus }) {
  if (orders === null) return <div className="box">Loading orders…</div>;
  return (
    <>
      {error && <p className="err">{error}</p>}
      {!orders.length && <div className="box">No orders yet. When a customer orders from your shop it appears here.</div>}
      {orders.map((o) => {
        const step = STEPS.indexOf(o.status), cancelled = o.status === 'cancelled';
        const next = ACTION[o.status];
        const unpaid = !['held', 'released'].includes(o.payment_status);
        const a = o.delivery_address;
        return (
          <div className="box" key={o.id}>
            <div className="rowb">
              <h3 style={{ margin: 0 }}>Order {o.id.slice(0, 8).toUpperCase()} · {o.customer?.name || 'Customer'}</h3>
              <span className={`badge ${cancelled ? 'bad' : step < 4 ? 'pend' : ''}`}>{cap(o.status)}</span>
            </div>
            <p className="sm">Placed {day(o.placed_at)} · {PAY[o.payment_status] || o.payment_status} · {o.payment_method === 'cod' ? 'Cash on delivery' : 'Online payment'}</p>
            {!cancelled && <div className="trk">{STEPS.map((s, i) => <i key={s} className={i <= step ? 'd' : ''} title={cap(s)} />)}</div>}
            {o.items.map((i, k) => <div key={k} className="sm">{i.name} ({i.size}{i.color ? `, ${i.color}` : ''}) ×{i.qty} · {bdt(i.unit_price * i.qty)}</div>)}
            {a && <p className="sm" style={{ marginTop: 8 }}>Deliver to: {a.name}, {a.phone}, {a.line1}{a.area ? `, ${a.area}` : ''}, {a.city}</p>}
            <div className="rowb" style={{ marginTop: 12 }}>
              <b>{bdt(o.total)}{o.seller_payout != null && <span className="sm"> · you receive {bdt(o.seller_payout)} after commission</span>}</b>
              <span className="row g">
                {next && <button className="btn sm2" disabled={busy === o.id || (next.needsPay && unpaid)} onClick={() => setStatus(o.id, next.to)}>{next.label}</button>}
                {CANCELLABLE.includes(o.status) && <button className="btn alt sm2" disabled={busy === o.id} onClick={() => { if (window.confirm('Cancel this order?')) setStatus(o.id, 'cancelled'); }}>Cancel</button>}
                {!next && !CANCELLABLE.includes(o.status) && <span className="badge">{cap(o.status)}</span>}
              </span>
            </div>
            {next?.needsPay && unpaid && <p className="sm">Waiting for the customer&apos;s payment. You can accept once it is paid.</p>}
            {o.status === 'shipped' && <p className="sm">The customer can also confirm delivery themselves.</p>}
          </div>
        );
      })}
    </>
  );
}
