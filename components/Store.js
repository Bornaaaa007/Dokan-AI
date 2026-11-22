'use client';
import { createContext, useContext, useState } from 'react';
import { PRODUCTS, DELIVERY } from '../lib/data';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);
const price = (pid) => PRODUCTS.find((p) => p.id === pid).price;
export const itemsTotal = (items) => items.reduce((s, i) => s + price(i.pid) * i.qty, 0);

export function StoreProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([
    { id: 1001, shopId: 1, items: [{ pid: 2, size: 'M', qty: 1 }], method: 'bKash', status: 'Placed', customer: 'Rafi A.', customerId: null },
    { id: 1002, shopId: 1, items: [{ pid: 1, size: 'Free', qty: 1 }], method: 'COD', status: 'Shipped', customer: 'Tania S.', customerId: null },
  ]);
  const [complaints, setComplaints] = useState([
    { id: 1, orderId: 1002, by: 'Customer', against: 'Quick Trends', reason: 'Item differs from photos', text: 'Received a cheaper fabric.', status: 'Submitted' },
  ]);
  const add = (pid, size, qty = 1) => setCart((c) => { const k = c.find((x) => x.pid === pid && x.size === size); return k ? c.map((x) => (x === k ? { ...x, qty: x.qty + qty } : x)) : [...c, { pid, size, qty }]; });
  const remove = (pid, size) => setCart((c) => c.filter((x) => !(x.pid === pid && x.size === size)));
  const place = (method, buyer) => {
    const byShop = {};
    cart.forEach((i) => { const s = PRODUCTS.find((p) => p.id === i.pid).shop; (byShop[s] ||= []).push(i); });
    const made = Object.entries(byShop).map(([s, items], n) => ({
      id: Date.now() % 100000 + n,
      shopId: +s,
      items,
      method,
      status: 'Placed',
      customer: buyer?.name || 'Customer',
      customerId: buyer?.id ?? null,
      delivery: DELIVERY,
    }));
    setOrders((o) => [...made, ...o]); setCart([]);
  };
  const setStatus = (id, status) => setOrders((o) => o.map((x) => (x.id === id ? { ...x, status } : x)));
  return <Ctx.Provider value={{ cart, add, remove, place, orders, setStatus, complaints, setComplaints }}>{children}</Ctx.Provider>;
}