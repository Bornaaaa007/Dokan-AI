'use client';
import Link from 'next/link';
import { useLang } from './LangProvider';
import { useStore } from './Store';

export default function Navbar() {
  const { toggle, t } = useLang();
  const { cart } = useStore();
  return (
    <>
  
      <header className="nav"><div className="wrap row">
        <Link className="logo" href="/">Dokan<b>AI</b></Link>
        <nav><Link href="/shop">Shop</Link><Link href="/stylist">AI Stylist</Link><Link href="/orders">Orders</Link><Link href="/seller">Seller Hub</Link><Link href="/admin">Admin</Link></nav>
        <div className="row g">
          <button className="ghost" onClick={toggle}>{t.toggle}</button>
          <Link className="ghost" href="/cart">🛒 {cart.reduce((s, i) => s + i.qty, 0)}</Link>
          <Link className="btn sm" href="/login">Log in</Link>
        </div>
      </div></header>
    </>
  );
}
