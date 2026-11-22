'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLang } from './LangProvider';
import { useStore } from './Store';
import { useAuth } from './AuthProvider';

export default function Navbar() {
  const { toggle, t } = useLang();
  const { cart } = useStore();
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <>
      <header className="nav"><div className="wrap row">
        <Link className="logo" href="/">Dokan<b>AI</b></Link>
        <nav><Link href="/shop">Shop</Link><Link href="/stylist">AI Stylist</Link><Link href="/orders">Orders</Link><Link href="/seller">Seller Hub</Link><Link href="/admin">Admin</Link></nav>
        <div className="row g">
          <button className="ghost" onClick={toggle}>{t.toggle}</button>
          <Link className="ghost" href="/cart">🛒 {cart.reduce((s, i) => s + i.qty, 0)}</Link>
          {!loading && (user ? (
            <>
              <span className="ghost">{profile?.name ?? user.email}</span>
              <button className="btn sm" onClick={handleLogout}>Log out</button>
            </>
          ) : (
            <Link className="btn sm" href="/login">Log in</Link>
          ))}
        </div>
      </div></header>
    </>
  );
}