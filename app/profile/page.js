'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { bdt } from '../../lib/data';
import { api } from '../../lib/api';
import { useAuth } from '../../components/AuthProvider';
import RequireAuth from '../../components/RequireAuth';

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const initials = (name) => (name || '?').split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const ROLE_LABEL = { customer: 'Customer', seller: 'Seller', admin: 'Admin' };

const css = `
.pf{max-width:880px;margin:0 auto}
.pf-head{display:flex;align-items:center;gap:20px;flex-wrap:wrap;padding:24px;background:var(--card);border:1px solid var(--line);border-radius:20px}
.pf-av{width:76px;height:76px;border-radius:50%;display:grid;place-items:center;font-size:28px;font-weight:800;color:#fff;background:linear-gradient(135deg,var(--pri2),var(--pri));flex:none}
.pf-who{flex:1;min-width:200px}
.pf-who h1{font-size:26px;margin:0 0 2px}
.pf-who p{margin:0;color:var(--mut);font-size:14px}
.pf-roles{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.pf-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin:18px 0 0}
.pf-stat{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px 18px}
.pf-stat b{display:block;font-size:22px}
.pf-stat span{color:var(--mut);font-size:13px}
.pf-tabs{display:flex;gap:4px;margin:24px 0 18px;border-bottom:1px solid var(--line)}
.pf-tabs button{background:none;border:0;padding:10px 16px;font:600 14px inherit;color:var(--mut);cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-1px}
.pf-tabs button.on{color:var(--pri);border-bottom-color:var(--pri)}
.pf-card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:24px}
.pf-card h3{margin:0 0 4px;font-size:18px}
.pf-hint{color:var(--mut);font-size:14px;margin:0 0 20px}
.pf-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.pf-field small{display:block;color:var(--mut);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}
.pf-field div{font-weight:600;word-break:break-word}
.pf-field .empty{color:var(--mut);font-weight:400}
.pf-field.full{grid-column:1 / -1}
.pf-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}
.pf-alert{padding:11px 14px;border-radius:12px;font-size:14px;margin-bottom:16px}
.pf-alert.ok{background:color-mix(in srgb,var(--ok) 14%,transparent);color:var(--ok)}
.pf-alert.err{background:#fde7e5;color:#b3261e}
.pf-form{display:grid;gap:16px;max-width:420px}
.pf-chips{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
.pf-chips button{border:1.5px solid var(--line);background:var(--card);color:var(--ink);padding:6px 14px;border-radius:99px;cursor:pointer;font:600 13px inherit}
.pf-chips button.on{border-color:var(--pri);color:var(--pri);background:var(--tint)}
.pf-order{padding:16px 0;border-bottom:1px solid var(--line)}
.pf-order:last-child{border-bottom:0;padding-bottom:0}
.pf-order:first-child{padding-top:0}
.pf-orow{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.pf-orow b{font-size:15px}
.pf-items{color:var(--mut);font-size:13.5px;margin:6px 0 10px}
.pf-empty{text-align:center;padding:30px 10px;color:var(--mut)}
@media(max-width:640px){.pf-grid{grid-template-columns:1fr}.pf-head{padding:18px}}
`;

function ProfileInner() {
  const { user, profile, refreshProfile } = useAuth();
    const [orders, setOrders] = useState(null);
  useEffect(() => {
    if (!profile?.roles?.includes('customer')) return;
    api('/orders?as=customer&limit=50').then((r) => setOrders(r.data)).catch(() => setOrders([]));
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const roles = profile?.roles ?? [];
  const isCustomer = roles.includes('customer');

  const [tab, setTab] = useState('overview');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [dBusy, setDBusy] = useState(false);
  const [dMsg, setDMsg] = useState(null);

  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pBusy, setPBusy] = useState(false);
  const [pMsg, setPMsg] = useState(null);

  const [flt, setFlt] = useState('all');

    const mine = orders || [];
  const delivered = mine.filter((o) => o.status === 'delivered');
  const active = mine.filter((o) => !['delivered', 'cancelled'].includes(o.status));
  const spent = mine.filter((o) => ['held', 'released'].includes(o.payment_status)).reduce((s, o) => s + o.total, 0);
  const shown = flt === 'all' ? mine : flt === 'done' ? delivered : active;

  const goTab = (t) => { setTab(t); setDMsg(null); setPMsg(null); };

  const startEdit = () => { setName(profile.name ?? ''); setPhone(profile.phone ?? ''); setDMsg(null); setEditing(true); };
  const cancelEdit = () => { setEditing(false); setDMsg(null); };

  const saveDetails = async (e) => {
    e.preventDefault();
    setDMsg(null);
    if (name.trim().length < 2) return setDMsg({ ok: false, text: 'Please enter your full name.' });
    if (phone.trim() && !/^01[0-9]{9}$/.test(phone.trim())) {
      return setDMsg({ ok: false, text: 'Phone must look like 01XXXXXXXXX.' });
    }
    setDBusy(true);
    const { data, error } = await supabase
      .from('users')
      .update({ name: name.trim(), phone: phone.trim() || null })
      .eq('auth_id', user.id)
      .select('id');
    setDBusy(false);
    if (error || !data?.length) {
      return setDMsg({ ok: false, text: error?.message || 'Could not save. Make sure the profile SQL has been run in Supabase.' });
    }
    await refreshProfile();
    setEditing(false);
    setDMsg({ ok: true, text: 'Profile updated successfully.' });
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPMsg(null);
    if (newPw.length < 6) return setPMsg({ ok: false, text: 'New password must be at least 6 characters.' });
    if (newPw !== confirmPw) return setPMsg({ ok: false, text: 'New passwords do not match.' });
    setPBusy(true);
    const { error: reErr } = await supabase.auth.signInWithPassword({ email: user.email, password: curPw });
    if (reErr) {
      setPBusy(false);
      return setPMsg({ ok: false, text: 'Current password is incorrect.' });
    }
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPBusy(false);
    if (error) return setPMsg({ ok: false, text: error.message });
    setCurPw(''); setNewPw(''); setConfirmPw('');
    setPMsg({ ok: true, text: 'Password updated successfully.' });
  };

  return (
    <div className="wrap page">
      <style>{css}</style>
      <div className="pf">
        {/* Header */}
        <div className="pf-head">
          <div className="pf-av">{initials(profile.name)}</div>
          <div className="pf-who">
            <h1>{profile.name}</h1>
            <p>{user.email}</p>
            <div className="pf-roles">
              {roles.map((r) => <span className="chip" key={r}>{ROLE_LABEL[r] ?? r}</span>)}
            </div>
          </div>
          {tab === 'overview' && !editing && (
            <button className="btn alt" onClick={startEdit}>✎ Edit profile</button>
          )}
        </div>

        {/* Stats (customers) */}
        {isCustomer && (
          <div className="pf-stats">
            <div className="pf-stat"><b>{mine.length}</b><span>Total orders</span></div>
            <div className="pf-stat"><b>{active.length}</b><span>In progress</span></div>
            <div className="pf-stat"><b>{delivered.length}</b><span>Delivered</span></div>
            <div className="pf-stat"><b>{bdt(spent)}</b><span>Total spent</span></div>
          </div>
        )}

        {/* Tabs */}
        <div className="pf-tabs">
          <button className={tab === 'overview' ? 'on' : ''} onClick={() => goTab('overview')}>Overview</button>
          {isCustomer && <button className={tab === 'orders' ? 'on' : ''} onClick={() => goTab('orders')}>Orders</button>}
          <button className={tab === 'security' ? 'on' : ''} onClick={() => goTab('security')}>Security</button>
        </div>

        {/* Overview */}
        {tab === 'overview' && (
          <div className="pf-card">
            <h3>Personal information</h3>
            <p className="pf-hint">{editing ? 'Update your details and save.' : 'Your account details.'}</p>
            {dMsg && <div className={`pf-alert ${dMsg.ok ? 'ok' : 'err'}`}>{dMsg.text}</div>}

            {!editing ? (
              <div className="pf-grid">
                <div className="pf-field"><small>Full name</small><div>{profile.name}</div></div>
                <div className="pf-field"><small>Email</small><div>{user.email}</div></div>
                <div className="pf-field"><small>Phone</small><div>{profile.phone || <span className="empty">Not added</span>}</div></div>
                <div className="pf-field"><small>Account type</small><div>{roles.map((r) => ROLE_LABEL[r] ?? r).join(', ')}</div></div>
              </div>
            ) : (
              <form onSubmit={saveDetails}>
                <div className="pf-grid">
                  <label>Full name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
                  <label>Phone<input placeholder="01XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
                  <label className="pf-field full">Email<input value={user.email} disabled /></label>
                </div>
                <div className="pf-actions">
                  <button className="btn" disabled={dBusy}>{dBusy ? 'Saving…' : 'Save changes'}</button>
                  <button type="button" className="btn alt" onClick={cancelEdit} disabled={dBusy}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Orders */}
        {tab === 'orders' && isCustomer && (
          <div className="pf-card">
            <h3>Order history</h3>
            <p className="pf-hint">Everything you have ordered on Dokan AI.</p>
            <div className="pf-chips">
              {[['all', `All (${mine.length})`], ['active', `In progress (${active.length})`], ['done', `Delivered (${delivered.length})`]].map(([k, l]) => (
                <button key={k} className={flt === k ? 'on' : ''} onClick={() => setFlt(k)}>{l}</button>
              ))}
            </div>
            {!shown.length ? (
              <div className="pf-empty">
                <p>{orders === null ? 'Loading your orders…' : 'No orders here yet.'}</p>
                <Link className="btn sm" href="/shop">Start shopping</Link>
              </div>
            ) : shown.map((o) => (
              <div className="pf-order" key={o.id}>
                <div className="pf-orow">
                                    <b>Order {o.id.slice(0, 8).toUpperCase()} · {o.shop_name}</b>
                  <span className={`badge ${o.status === 'cancelled' ? 'bad' : o.status !== 'delivered' ? 'pend' : ''}`}>{cap(o.status)}</span>
                </div>
                <div className="pf-items">{o.items.map((i) => `${i.name} (${i.size}) ×${i.qty}`).join(' · ')}</div>
                <div className="pf-orow">
                  <span><b>{bdt(o.total)}</b> <span className="sm">· {o.payment_method === 'cod' ? 'Cash on Delivery' : 'Online payment'}</span></span>
                  <Link className="btn alt sm" href="/orders">Track order</Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Security */}
        {tab === 'security' && (
          <div className="pf-card">
            <h3>Change password</h3>
            <p className="pf-hint">Use at least 6 characters. You will stay logged in on this device.</p>
            {pMsg && <div className={`pf-alert ${pMsg.ok ? 'ok' : 'err'}`}>{pMsg.text}</div>}
            <form className="pf-form" onSubmit={changePassword}>
              <label>Current password<input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} /></label>
              <label>New password<input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} /></label>
              <label>Confirm new password<input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} /></label>
              <div className="pf-actions" style={{ marginTop: 4 }}>
                <button className="btn" disabled={pBusy || !curPw || !newPw}>{pBusy ? 'Updating…' : 'Update password'}</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileGate() {
  const { profile } = useAuth();
  if (!profile) {
    return (
      <div className="wrap page">
        <h1>Profile not found</h1>
        <p className="sub">We could not find a profile record for this account. Please contact support or sign up again.</p>
      </div>
    );
  }
  return <ProfileInner />;
}

export default function Profile() {
  return (
    <RequireAuth>
      <ProfileGate />
    </RequireAuth>
  );
}