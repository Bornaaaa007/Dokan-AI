'use client';
import { useState } from 'react';
import Link from 'next/link';
import { PRODUCTS, shopOf, bdt, STATUS, DELIVERY } from '../../lib/data';
import { useStore, itemsTotal } from '../../components/Store';
import { useAuth } from '../../components/AuthProvider';
import RequireAuth from '../../components/RequireAuth';

// Demo: every seller manages shop #1 until shops are linked to users in the database.
const SELLER_SHOP_ID = 1;
const NEXT = { Placed: 'Accepted', Accepted: 'Packed', Packed: 'Shipped' };
const itemName = (pid) => PRODUCTS.find((p) => p.id === pid)?.name ?? 'Product';

function CustomerOrders({ profile }) {
  const { orders, setStatus } = useStore();
  const mine = orders.filter((o) => o.customerId === profile.id);
  return (
    <>
      <h1>My orders</h1>
      <p className="sub">Track every order. Confirm delivery or report a problem within 48 hours.</p>
      {!mine.length && <div className="box">No orders yet. <Link href="/shop">Start shopping</Link></div>}
      {mine.map((o) => { const step = STATUS.indexOf(o.status); return (
        <div className="box" key={o.id}>
          <div className="rowb"><h3 style={{ margin: 0 }}>Order #{o.id} · {shopOf(o.shopId).name}</h3><span className={`badge ${step < 4 ? 'pend' : ''}`}>{o.status}</span></div>
          <div className="trk">{STATUS.map((s, i) => <i key={s} className={i <= step ? 'd' : ''} title={s} />)}</div>
          <p className="sm">{STATUS.join(' → ')}</p>
          {o.items.map((i) => <div key={i.pid + i.size} className="sm">{itemName(i.pid)} ({i.size}) ×{i.qty}</div>)}
          <div className="rowb" style={{ marginTop: 12 }}><b>{bdt(itemsTotal(o.items) + DELIVERY)} · {o.method}</b>
            <span className="row g">{o.status === 'Shipped' && <button className="btn sm2" onClick={() => setStatus(o.id, 'Delivered')}>Confirm delivery</button>}
              {o.status === 'Delivered' && <span className="badge">Review unlocked ★</span>}
              <Link className="btn alt sm2" href={`/complaint?order=${o.id}`}>Report a problem</Link></span></div>
        </div>); })}
    </>
  );
}

function SellerOrders() {
  const { orders, setStatus } = useStore();
  const mine = orders.filter((o) => o.shopId === SELLER_SHOP_ID);
  return (
    <>
      <h1>Orders to fulfil</h1>
      <p className="sub">Accept new orders, pack them and mark them shipped. The customer sees every update.</p>
      {!mine.length && <div className="box">No orders yet.</div>}
      {mine.map((o) => { const step = STATUS.indexOf(o.status); return (
        <div className="box" key={o.id}>
          <div className="rowb"><h3 style={{ margin: 0 }}>Order #{o.id} · {o.customer}</h3><span className={`badge ${step < 4 ? 'pend' : ''}`}>{o.status}</span></div>
          <div className="trk">{STATUS.map((s, i) => <i key={s} className={i <= step ? 'd' : ''} title={s} />)}</div>
          {o.items.map((i) => <div key={i.pid + i.size} className="sm">{itemName(i.pid)} ({i.size}) ×{i.qty}</div>)}
          <div className="rowb" style={{ marginTop: 12 }}><b>{bdt(itemsTotal(o.items) + DELIVERY)} · {o.method}</b>
            {NEXT[o.status]
              ? <button className="btn sm2" onClick={() => setStatus(o.id, NEXT[o.status])}>Mark {NEXT[o.status]}</button>
              : <span className="badge">{o.status === 'Shipped' ? 'Waiting for customer to confirm' : o.status}</span>}
          </div>
        </div>); })}
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
      {(isCustomer && (!isSeller || view === 'buy')) && <CustomerOrders profile={profile} />}
      {(isSeller && (!isCustomer || view === 'sell')) && <SellerOrders />}
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