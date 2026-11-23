'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { bdt, PRODUCTS } from '../../lib/data';
import { useAuth } from '../../components/AuthProvider';
import RequireAuth from '../../components/RequireAuth';
import SellerOrders, { useSellerOrders } from '../../components/SellerOrders';

const STEPS = ['placed', 'accepted', 'packed', 'shipped', 'delivered'];
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const PAY = { pending: 'Payment pending', failed: 'Payment failed', held: 'Paid · held safely until delivery', released: 'Paid', refunded: 'Refunded' };
const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', year: 'numeric' });

function CustomerOrders() {
  const [orders, setOrders] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState('');

  const load = async () => {
    try { setOrders((await api('/orders?as=customer&limit=50')).data); }
    catch (e) { setError(e.message); setOrders((o) => o ?? []); }
  };
  useEffect(() => { load(); }, []);

  const act = async (id, fn) => {
    setBusy(id); setError('');
    try { await fn(); await load(); } catch (e) { setError(e.message); }
    setBusy('');
  };
  const setStatus = (id, status) => act(id, () => api(`/orders/${id}/status`, { method: 'PATCH', body: { status } }));
  const payNow = (id) => act(id, () => api(`/orders/${id}/pay`, { method: 'POST', body: { gateway: 'bkash', outcome: 'success' } }));

  if (orders === null) return <p className="sub">Loading your orders…</p>;

  return (
    <>
      <h1>My orders</h1>
      <p className="sub">Track every order. Confirm delivery or report a problem within 48 hours.</p>
      {error && <p className="err">{error}</p>}
      {!orders.length && <div className="box">No orders yet. <Link href="/shop">Start shopping</Link></div>}
      {orders.map((o) => {
        const step = STEPS.indexOf(o.status), cancelled = o.status === 'cancelled';
        const unpaid = ['pending', 'failed'].includes(o.payment_status) && !cancelled;
        return (
          <div className="box" key={o.id}>
            <div className="rowb"><h3 style={{ margin: 0 }}>Order {o.id.slice(0, 8).toUpperCase()} · {o.shop_name}</h3>
              <span className={`badge ${cancelled ? 'bad' : step < 4 ? 'pend' : ''}`}>{cap(o.status)}</span></div>
            <p className="sm">Placed {day(o.placed_at)} · {PAY[o.payment_status] || o.payment_status}</p>
            {!cancelled && <div className="trk">{STEPS.map((s, i) => <i key={s} className={i <= step ? 'd' : ''} title={cap(s)} />)}</div>}
            {!cancelled && <p className="sm">{STEPS.map(cap).join(' → ')}</p>}
            {o.items.map((i, k) => {
              const listed = o.status === 'delivered' ? PRODUCTS.find((p) => p.uuid === i.product_id) : null;   // reviews open after delivery
              return <div key={k} className="sm">{i.name} ({i.size}{i.color ? `, ${i.color}` : ''}) ×{i.qty} · {bdt(i.unit_price * i.qty)}{listed && <> · <Link href={`/product/${listed.id}#reviews`}>Review this product</Link></>}</div>;
            })}
            <div className="rowb" style={{ marginTop: 12 }}>
              <b>{bdt(o.total)} · {o.payment_method === 'cod' ? 'Cash on Delivery' : 'Online payment'}</b>
              <span className="row g">
                {unpaid && <button className="btn sm2" disabled={busy === o.id} onClick={() => payNow(o.id)}>Pay now</button>}
                {o.status === 'placed' && <button className="btn alt sm2" disabled={busy === o.id} onClick={() => setStatus(o.id, 'cancelled')}>Cancel order</button>}
                {o.status === 'shipped' && <button className="btn sm2" disabled={busy === o.id} onClick={() => setStatus(o.id, 'delivered')}>Confirm delivery</button>}
                {!cancelled && <Link className="btn alt sm2" href={`/complaint?order=${o.id}`}>Report a problem</Link>}
              </span>
            </div>
            {o.delivery_address && <p className="sm" style={{ marginTop: 8 }}>Deliver to: {o.delivery_address.name}, {o.delivery_address.line1}, {o.delivery_address.city}</p>}
          </div>
        );
      })}
    </>
  );
}

// Seller side uses the same component as the Seller Hub, so both stay identical.
function SellerView() {
  const { orders, error, busy, setStatus } = useSellerOrders();
  return (
    <>
      <h1>Orders to fulfil</h1>
      <p className="sub">Accept new orders, pack them and mark them shipped. The customer sees every update.</p>
      <SellerOrders orders={orders} error={error} busy={busy} setStatus={setStatus} />
    </>
  );
}

function OrdersInner() {
  const { profile } = useAuth();
  const isSeller = !!profile?.roles?.includes('seller');
  const isCustomer = !!profile?.roles?.includes('customer');
  const [view, setView] = useState(isCustomer ? 'buy' : 'sell');

  if (!isSeller && !isCustomer) {
    return <div className="wrap page"><h1>Access denied</h1><p className="sub">Orders are for customers and sellers.</p></div>;
  }

  return (
    <div className="wrap page">
      {isSeller && isCustomer && (
        <div className="tabs">
          <button className={view === 'buy' ? 'on' : ''} onClick={() => setView('buy')}>My purchases</button>
          <button className={view === 'sell' ? 'on' : ''} onClick={() => setView('sell')}>Orders to fulfil</button>
        </div>
      )}
      {(isCustomer && (!isSeller || view === 'buy')) && <CustomerOrders />}
      {(isSeller && (!isCustomer || view === 'sell')) && <SellerView />}
    </div>
  );
}

export default function Orders() {
  return (
    <RequireAuth>
      <OrdersInner />
    </RequireAuth>
  );
}