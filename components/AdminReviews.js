'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', year: 'numeric' });
const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

// Admin tab: approve or hide platform reviews (home page), and hide or show product reviews (product pages).
const KINDS = {
  platform: { path: 'reviews', statuses: ['pending', 'approved', 'hidden'], show: 'approved', hide: 'hidden', showLabel: 'Approve', hideLabel: 'Hide' },
  product: { path: 'product-reviews', statuses: ['visible', 'hidden'], show: 'visible', hide: 'hidden', showLabel: 'Show', hideLabel: 'Hide' },
};
export default function AdminReviews() {
  const [kind, setKind] = useState('platform');
  const k = KINDS[kind];
  const [status, setStatus] = useState('pending'), [rows, setRows] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState('');
  const pick = (next) => { setKind(next); setStatus(KINDS[next].statuses[0]); };
  const load = useCallback(async () => {
    setRows(null); setErr('');
    try { setRows((await api(`/admin/${k.path}?status=${status}`)).data.reviews); } catch (e) { setErr(e.message); setRows([]); }
  }, [k.path, status]);
  useEffect(() => { load(); }, [load]);

  const decide = async (id, next) => {
    setBusy(id); setErr('');
    try { await api(`/admin/${k.path}/${id}`, { method: 'PATCH', body: { status: next } }); await load(); }
    catch (e) { setErr(e.message); }
    setBusy('');
  };
  return (
    <>
      <div className="tabs">{[['platform', 'Platform reviews'], ['product', 'Product reviews']].map(([key, label]) => <button key={key} className={kind === key ? 'on' : ''} onClick={() => pick(key)}>{label}</button>)}</div>
      <div className="tabs">{k.statuses.map((s) => <button key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{s[0].toUpperCase() + s.slice(1)}</button>)}</div>
      {err && <p className="err">{err}</p>}
      {rows === null ? <div className="box">Loading…</div> : !rows.length ? <div className="box">No {status} reviews.</div> : rows.map((r) => (
        <div className="box" key={r.id}>
          <div className="rowb"><div><b>{stars(r.rating)}</b> · {r.name || 'User'} · {day(r.created_at)}{r.product_name ? <> · on <i>{r.product_name}</i></> : null}
            <p style={{ margin: '6px 0 0' }}>{r.body}</p></div>
            <span className="row g">
              {status !== k.show && <button className="btn sm2" disabled={busy === r.id} onClick={() => decide(r.id, k.show)}>{k.showLabel}</button>}
              {status !== k.hide && <button className="btn alt sm2" disabled={busy === r.id} onClick={() => decide(r.id, k.hide)}>{k.hideLabel}</button>}
            </span></div>
        </div>
      ))}
    </>
  );
}
