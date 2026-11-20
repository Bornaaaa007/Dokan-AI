'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PRODUCTS, shopOf, bdt, DELIVERY } from '../../lib/data';
import { useStore, itemsTotal } from '../../components/Store';

export default function Cart() {
  const { cart, remove, place } = useStore(), r = useRouter();
  const [method, setMethod] = useState('bKash'), [addr, setAddr] = useState({ name: '', phone: '', district: 'Dhaka', line: '' }), [pay, setPay] = useState('');
  const groups = {};
  cart.forEach((i) => { const p = PRODUCTS.find((x) => x.id === i.pid); (groups[p.shop] ||= []).push({ ...i, p }); });
  const n = Object.keys(groups).length, total = itemsTotal(cart) + n * DELIVERY;
  const set = (k) => (e) => setAddr({ ...addr, [k]: e.target.value });
  if (!cart.length) return <div className="wrap page"><h1>Your cart is empty</h1><Link className="btn" href="/shop">Browse products</Link></div>;
  const go = (e) => { e.preventDefault(); setPay('Processing…'); setTimeout(() => { place(method); r.push('/orders'); }, 900); };
  return (
    <div className="wrap page"><h1>Cart &amp; checkout</h1><p className="sub">Items from different sellers become separate orders.</p>
      <div className="two">
        <div>{Object.entries(groups).map(([sid, items]) => (
          <div className="box" key={sid}><h3>Order from {shopOf(+sid).name}</h3>
            {items.map((i) => <div className="rowb" key={i.pid + i.size} style={{ padding: '6px 0' }}><span>{i.p.name} <span className="sm">({i.size}) ×{i.qty}</span></span><span>{bdt(i.p.price * i.qty)} <button className="ghost" onClick={() => remove(i.pid, i.size)}>✕</button></span></div>)}
            <p className="sm">Delivery {bdt(DELIVERY)}</p></div>))}</div>
        <form className="box form wide" onSubmit={go}>
          <h3>Delivery address</h3>
          <div className="f2"><input required placeholder="Full name" value={addr.name} onChange={set('name')} /><input required placeholder="Phone (01XXXXXXXXX)" pattern="01[0-9]{9}" value={addr.phone} onChange={set('phone')} /></div>
          <select value={addr.district} onChange={set('district')}>{['Dhaka', 'Chattogram', 'Comilla', 'Sylhet', 'Rajshahi', 'Khulna'].map((d) => <option key={d}>{d}</option>)}</select>
          <input required placeholder="Upazila, area, house / road" value={addr.line} onChange={set('line')} />
          <h3>Payment (sandbox)</h3>
          <div className="opts">{['bKash', 'Nagad', 'Card', 'COD'].map((m) => <button type="button" key={m} className={method === m ? 'on' : ''} onClick={() => setMethod(m)}>{m === 'COD' ? 'Cash on Delivery' : m}</button>)}</div>
          {method === 'COD' && <p className="sm">For COD you pay the delivery charge ({bdt(n * DELIVERY)}) online first; the item price is paid in cash to the courier.</p>}
          <p className="sm">Funds are held in escrow until you confirm delivery or 48 hours pass.</p>
          <div className="tot"><span>Total</span><span>{bdt(total)}</span></div>
          <button className="btn" disabled={!!pay}>{pay || `Pay ${bdt(method === 'COD' ? n * DELIVERY : total)}`}</button>
        </form>
      </div>
    </div>
  );
}
