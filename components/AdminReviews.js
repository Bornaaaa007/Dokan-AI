'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', year: 'numeric' });
const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

// Admin tab: approve or hide platform reviews (the ones shown on the home page).
export default function AdminReviews() {
  const [status, setStatus] = useState('pending'), [rows, setRows] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState('');
  const load = useCallback(async () => {
    setRows(null); setErr('');
    try { setRows((await api(`/admin/reviews?status=${status}`)).data.reviews); } catch (e) { setErr(e.message); setRows([]); }
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const decide = async (id, next) => {
    setBusy(id); setErr('');
    try { await api(`/admin/reviews/${id}`, { method: 'PATCH', body: { status: next } }); await load(); }
    catch (e) { setErr(e.message); }
    setBusy('');
  };
  return (
    <>
      <div className="tabs">{['pending', 'approved', 'hidden'].map((s) => <button key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{s[0].toUpperCase() + s.slice(1)}</button>)}</div>
      {err && <p className="err">{err}</p>}
      {rows === null ? <div className="box">Loading…</div> : !rows.length ? <div className="box">No {status} reviews.</div> : rows.map((r) => (
        <div className="box" key={r.id}>
          <div className="rowb"><div><b>{stars(r.rating)}</b> · {r.name || 'User'} · {day(r.created_at)}
            <p style={{ margin: '6px 0 0' }}>{r.body}</p></div>
            <span className="row g">
              {status !== 'approved' && <button className="btn sm2" disabled={busy === r.id} onClick={() => decide(r.id, 'approved')}>Approve</button>}
              {status !== 'hidden' && <button className="btn alt sm2" disabled={busy === r.id} onClick={() => decide(r.id, 'hidden')}>Hide</button>}
            </span></div>
        </div>
      ))}
    </>
  );
}
