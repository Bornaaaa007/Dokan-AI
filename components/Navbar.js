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

  const roles = profile?.roles ?? [];
  const isSeller = roles.includes('seller');
  const isAdmin = roles.includes('admin');
  const isCustomer = roles.includes('customer');
  const canSeeOrders = !!user && (isSeller || isCustomer);

  const handleLogout = async () => {
    await signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <>
      <header className="nav"><div className="wrap row">
        <Link className="logo" href="/">Dokan<b>AI</b></Link>
        <nav>
          <Link href="/shop">Shop</Link>
          <Link href="/stylist">AI Stylist</Link>
          {canSeeOrders && <Link href="/orders">Orders</Link>}
          {canSeeOrders && <Link href="/complaint">Complaints</Link>}
          {isSeller && <Link href="/seller">Seller Hub</Link>}
          {isAdmin && <Link href="/admin">Admin</Link>}
        </nav>
        <div className="row g">
          <button className="ghost" onClick={toggle}>{t.toggle}</button>
          <Link className="ghost" href="/cart">🛒 {cart.reduce((s, i) => s + i.qty, 0)}</Link>
          {!loading && (user ? (
            <>
             <Link className="ghost" href="/profile">{profile?.name ?? user.email}</Link>
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