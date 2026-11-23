'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { PRODUCTS } from '../lib/data';
import { loadCatalog } from '../lib/catalog';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);
const price = (pid) => PRODUCTS.find((p) => p.id === pid)?.price ?? 0;
export const itemsTotal = (items) => items.reduce((s, i) => s + price(i.pid) * i.qty, 0);

// Holds the cart only. Orders, payments and complaints now live in the backend (see lib/api.js).
export function StoreProvider({ children }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { loadCatalog().finally(() => setReady(true)); }, []);   // products come from the database
  const [cart, setCart] = useState([]);
  const add = (pid, size, qty = 1) => setCart((c) => { const k = c.find((x) => x.pid === pid && x.size === size); return k ? c.map((x) => (x === k ? { ...x, qty: x.qty + qty } : x)) : [...c, { pid, size, qty }]; });
  const remove = (pid, size) => setCart((c) => c.filter((x) => !(x.pid === pid && x.size === size)));
  if (!ready) return <div className="wrap page"><p className="sub">Loading…</p></div>;
  return <Ctx.Provider value={{ cart, add, remove }}>{children}</Ctx.Provider>;
}