'use client';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '../../lib/api';
import { useAuth } from '../../components/AuthProvider';
import RequireAuth from '../../components/RequireAuth';

const REASONS = {
  customer: [['not_delivered', 'Item never delivered'], ['not_as_described', 'Item differs from photos or description'], ['wrong_size', 'Wrong size sent'], ['other', 'Something else']],
  seller: [['refused_delivery', 'Customer refused delivery'], ['false_claim', 'False claim by the customer'], ['other', 'Something else']],
};
const reasonLabel = (code) => [...REASONS.customer, ...REASONS.seller].find(([c]) => c === code)?.[1] || code;
const STATUS = { submitted: ['Waiting for response', 'pend'], responded: ['Under admin review', 'pend'], upheld: ['Upheld', ''], rejected: ['Rejected', 'bad'], appealed: ['Appealed', 'pend'] };
const links = (t) => t.split(/\s+/).filter(Boolean);
const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', year: 'numeric' });

function FileForm({ onFiled }) {
  const sp = useSearchParams(), { profile } = useAuth();
  const roles = profile?.roles || [];
  const both = roles.includes('customer') && roles.includes('seller');
  const [role, setRole] = useState(roles.includes('customer') ? 'customer' : 'seller');
  const [orderId, setOrderId] = useState(sp.get('order') || ''), [reason, setReason] = useState('not_delivered');
  const [text, setText] = useState(''), [ev, setEv] = useState('');
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [done, setDone] = useState(false);

  const pickRole = (r) => { setRole(r); setReason(REASONS[r][0][0]); };

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      await api(`/orders/${orderId.trim()}/complaints`, { method: 'POST', body: { reason_code: reason, description: text.trim(), evidence_urls: links(ev) } });
      setDone(true); onFiled && onFiled();
    } catch (x) { setErr(x.message); }
    setBusy(false);
  };

  if (done) return <div className="box"><h3>Complaint submitted ✓</h3><p className="sm">Payment stays in escrow. The other side has 48 hours to respond; an admin then reviews both sides and records a written decision.</p></div>;
  return (
    <form className="form" onSubmit={submit}>
      {both && <select value={role} onChange={(e) => pickRole(e.target.value)}><option value="customer">I am the buyer</option><option value="seller">I am the seller</option></select>}
      <input required placeholder="Order ID (full id from My orders)" value={orderId} onChange={(e) => setOrderId(e.target.value)} />
      <select value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS[role].map(([c, l]) => <option key={c} value={c}>{l}</option>)}</select>
      <textarea required minLength={10} maxLength={2000} placeholder="Describe what happened (at least 10 characters)" value={text} onChange={(e) => setText(e.target.value)} />
      <textarea placeholder="Evidence links, one per line (photos, video, chat screenshots). Optional." value={ev} onChange={(e) => setEv(e.target.value)} />
      <p className="note">A fraud badge is never automatic: only an admin can issue one after verifying evidence.</p>
      {err && <p className="err">{err}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Submitting…' : 'Submit complaint'}</button>
    </form>
  );
}

function RespondForm({ c, onDone }) {
  const [text, setText] = useState(''), [ev, setEv] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const send = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await api(`/complaints/${c.id}/respond`, { method: 'POST', body: { response_text: text.trim(), evidence_urls: links(ev) } }); onDone(); }
    catch (x) { setErr(x.message); }
    setBusy(false);
  };
  return (
    <form className="form" onSubmit={send} style={{ marginTop: 10 }}>
      <textarea required minLength={10} maxLength={2000} placeholder="Your side of the story (one response only)" value={text} onChange={(e) => setText(e.target.value)} />
      <textarea placeholder="Evidence links, one per line. Optional." value={ev} onChange={(e) => setEv(e.target.value)} />
      {err && <p className="err">{err}</p>}
      <button className="btn sm2" disabled={busy}>{busy ? 'Sending…' : 'Send response'}</button>
    </form>
  );
}

function MyComplaints({ reloadKey }) {
  const [list, setList] = useState(null), [err, setErr] = useState('');
  const load = useCallback(async () => {
    try { setList((await api('/complaints/mine')).data.complaints); }
    catch (e) { setErr(e.message); setList([]); }
  }, []);
  useEffect(() => { load(); }, [load, reloadKey]);

  if (list === null) return <p className="sub">Loading your complaints…</p>;
  return (
    <>
      <h2 style={{ marginTop: 32 }}>My complaints</h2>
      {err && <p className="err">{err}</p>}
      {!list.length && <div className="box">No complaints.</div>}
      {list.map((c) => {
        const [lbl, cls] = STATUS[c.status] || [c.status, 'pend'];
        return (
          <div className="box" key={c.id}>
            <div className="rowb"><h3 style={{ margin: 0 }}>Order {String(c.order_id).slice(0, 8).toUpperCase()} · {reasonLabel(c.reason_code)}</h3><span className={`badge ${cls}`}>{lbl}</span></div>
            <p className="sm">{c.my_role === 'filer' ? 'Filed by you' : 'Filed against you'} · {day(c.created_at)}</p>
            <p>{c.description}</p>
            {c.response_text && <p className="sm"><b>Response:</b> {c.response_text}</p>}
            {c.decision_note && <p className="sm"><b>Admin decision:</b> {c.decision_note}</p>}
            {c.my_role === 'accused' && c.status === 'submitted' && <>
              <p className="sm">Please respond{c.response_due_at ? ` by ${day(c.response_due_at)}` : ''}.</p>
              <RespondForm c={c} onDone={load} />
            </>}
          </div>
        );
      })}
    </>
  );
}

function Page() {
  const [k, setK] = useState(0);
  return (
    <div className="wrap page">
      <h1>Report a problem</h1><p className="sub">Reviews and complaints are separate. Complaints are admin-verified.</p>
      <Suspense><FileForm onFiled={() => setK(k + 1)} /></Suspense>
      <MyComplaints reloadKey={k} />
    </div>
  );
}

export default function Complaint() { return <RequireAuth><Page /></RequireAuth>; }