'use client';
import Link from 'next/link';
import { PRODUCTS, shopOf, bdt, STATUS, DELIVERY } from '../../lib/data';
import { useStore, itemsTotal } from '../../components/Store';
import RequireAuth from '../../components/RequireAuth';

function OrdersInner() {
  const { orders, setStatus } = useStore();
  const mine = orders.filter((o) => o.customer === 'You' || o.customer === 'Tania S.');
  return (
    <div className="wrap page"><h1>My orders</h1><p className="sub">Track every order. Confirm delivery or report a problem within 48 hours.</p>
      {!mine.length && <div className="box">No orders yet. <Link href="/shop">Start shopping</Link></div>}
      {mine.map((o) => { const step = STATUS.indexOf(o.status); return (
        <div className="box" key={o.id}>
          <div className="rowb"><h3 style={{ margin: 0 }}>Order #{o.id} · {shopOf(o.shopId).name}</h3><span className={`badge ${step < 4 ? 'pend' : ''}`}>{o.status}</span></div>
          <div className="trk">{STATUS.map((s, i) => <i key={s} className={i <= step ? 'd' : ''} title={s} />)}</div>
          <p className="sm">{STATUS.join(' → ')}</p>
          {o.items.map((i) => <div key={i.pid + i.size} className="sm">{PRODUCTS.find((p) => p.id === i.pid).name} ({i.size}) ×{i.qty}</div>)}
          <div className="rowb" style={{ marginTop: 12 }}><b>{bdt(itemsTotal(o.items) + DELIVERY)} · {o.method}</b>
            <span className="row g">{o.status === 'Shipped' && <button className="btn sm2" onClick={() => setStatus(o.id, 'Delivered')}>Confirm delivery</button>}
              {o.status === 'Delivered' && <span className="badge">Review unlocked ★</span>}
              <Link className="btn alt sm2" href={`/complaint?order=${o.id}`}>Report a problem</Link></span></div>
        </div>); })}
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