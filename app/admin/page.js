'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import RequireAuth from '../../components/RequireAuth';
import LedgerPanel from '../../components/LedgerPanel';
import AdminReviews from '../../components/AdminReviews';
import { useLang } from '../../components/LangProvider';

const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', year: 'numeric' });
const REASON = { not_delivered: 'Not delivered', not_as_described: 'Not as described', wrong_size: 'Wrong size', refused_delivery: 'Refused delivery', false_claim: 'False claim', other: 'Other' };

// ---------------- Overview ----------------
function Overview({ goto }) {
  const [d, setD] = useState({}), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [shops, comps, ins, led] = await Promise.allSettled([
      api('/admin/shops?status=pending&limit=1'), api('/admin/complaints?status=open'), api('/admin/insights'), api('/admin/ledger?limit=1'),
    ]);
    setD({
      pending: shops.value?.meta?.total, open: comps.value?.data?.complaints?.length,
      suggestions: ins.value?.data?.suggestions || [], summary: led.value?.data?.summary,
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  const release = async () => {
    setBusy(true); setMsg('');
    try { const r = await api('/admin/payouts/release', { method: 'POST' }); setMsg(`${r.data.released} order(s) released to sellers.`); load(); }
    catch (e) { setMsg(e.message); }
    setBusy(false);
  };
  const s = d.summary;
  return (
    <>
      <div className="kpis">
        <div><b>{d.pending ?? '…'}</b><span>Shops awaiting verification</span></div>
        <div><b>{d.open ?? '…'}</b><span>Open complaints</span></div>
        <div><b>{s ? s.orders_held : '…'}</b><span>Orders in escrow</span></div>
        <div><b>{s ? s.orders_released : '…'}</b><span>Orders released</span></div>
        <div><b>48h</b><span>Escrow window</span></div>
      </div>
      <div className="box"><h3>Release payouts</h3>
        <p className="sm">Releases escrow for orders delivered 48 hours ago or more. Orders with an open or upheld complaint are skipped.</p>
        <button className="btn" disabled={busy} onClick={release}>{busy ? 'Releasing…' : 'Release due payouts'}</button>
        {msg && <p className="sm" style={{ marginTop: 8 }}>{msg}</p>}
      </div>
      {d.suggestions?.length > 0 && <div className="box"><h3>Demand suggestions</h3><ul>{d.suggestions.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
      <div className="row g"><button className="btn alt sm2" onClick={() => goto('Shops')}>Review shops</button><button className="btn alt sm2" onClick={() => goto('Complaints')}>Review complaints</button></div>
    </>
  );
}

// ---------------- Shop verification ----------------
function Shops() {
  const [status, setStatus] = useState('pending'), [rows, setRows] = useState(null), [err, setErr] = useState('');
  const [reasons, setReasons] = useState({}), [busy, setBusy] = useState('');
  const load = useCallback(async () => {
    setRows(null); setErr('');
    try { setRows((await api(`/admin/shops?status=${status}&limit=50`)).data); } catch (e) { setErr(e.message); setRows([]); }
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const decide = async (id, st) => {
    const reason = (reasons[id] || '').trim();
    if (st === 'rejected' && reason.length < 3) return setErr('A reason (3+ characters) is required to reject a shop.');
    setBusy(id); setErr('');
    try { await api(`/admin/shops/${id}/verification`, { method: 'PATCH', body: st === 'rejected' ? { status: st, reason } : { status: st } }); await load(); }
    catch (e) { setErr(e.message); }
    setBusy('');
  };
  return (
    <>
      <div className="tabs">{['pending', 'verified', 'rejected'].map((s) => <button key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{s[0].toUpperCase() + s.slice(1)}</button>)}</div>
      {err && <p className="err">{err}</p>}
      {rows === null ? <div className="box">Loading…</div> : !rows.length ? <div className="box">No {status} shops.</div> : rows.map((s) => (
        <div className="box" key={s.id}>
          <div className="rowb"><div><b>{s.name}</b> <span className="sm">· {s.city || 'No city'}</span></div><span className={`badge ${status === 'verified' ? '' : status === 'rejected' ? 'bad' : 'pend'}`}>{status}</span></div>
          <p className="sm">Page: {s.social_url ? <a href={s.social_url} target="_blank" rel="noreferrer">{s.social_url}</a> : '—'} · NID: {s.nid_number || '—'}</p>
          {s.rejection_note && <p className="sm">Rejection reason: {s.rejection_note}</p>}
          {status !== 'verified' && <button className="btn sm2" disabled={busy === s.id} onClick={() => decide(s.id, 'verified')}>Approve</button>}{' '}
          {status !== 'rejected' && <>
            <input placeholder="Reason for rejection" value={reasons[s.id] || ''} onChange={(e) => setReasons({ ...reasons, [s.id]: e.target.value })} style={{ maxWidth: 260, margin: '0 8px' }} />
            <button className="btn danger sm2" disabled={busy === s.id} onClick={() => decide(s.id, 'rejected')}>Reject</button>
          </>}
        </div>
      ))}
    </>
  );
}

// ---------------- Complaints ----------------

// AI triage panel text. The AI only suggests: the admin writes and records the decision.
const TRI = {
  en: { btn: '✨ AI review of this complaint', busy: '✨ Reading the thread…', again: '✨ Review again', head: 'AI suggestion (advisory only)',
    note: 'AI can be wrong and cannot open evidence links. You make the decision.', filer: 'Filer says', accused: 'Accused says', missing: 'Still to check', why: 'Why', conf: 'confidence', use: 'Use as my note (you can edit it)',
    sug: { uphold: 'Suggests: uphold', reject: 'Suggests: reject', need_more_info: 'Suggests: need more information' }, lv: { low: 'low', medium: 'medium', high: 'high' } },
  bn: { btn: '✨ এআই দিয়ে অভিযোগটি দেখুন', busy: '✨ অভিযোগ পড়া হচ্ছে…', again: '✨ আবার দেখুন', head: 'এআই-এর পরামর্শ (শুধু সহায়তা)',
    note: 'এআই ভুল করতে পারে এবং প্রমাণের লিংক খুলতে পারে না। সিদ্ধান্ত আপনার।', filer: 'অভিযোগকারী বলছেন', accused: 'অভিযুক্ত বলছেন', missing: 'আরও যা দেখা দরকার', why: 'কারণ', conf: 'নিশ্চয়তা', use: 'আমার নোট হিসেবে নিন (বদলাতে পারবেন)',
    sug: { uphold: 'পরামর্শ: অভিযোগ বহাল রাখুন', reject: 'পরামর্শ: অভিযোগ খারিজ করুন', need_more_info: 'পরামর্শ: আরও তথ্য দরকার' }, lv: { low: 'কম', medium: 'মাঝারি', high: 'বেশি' } },
};

function Decide({ id, onDone }) {
  const [d, setD] = useState(null), [note, setNote] = useState(''), [proof, setProof] = useState(false);
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [res, setRes] = useState(null);
  const { lang } = useLang();
  const X = TRI[lang] ?? TRI.en;
  const [tri, setTri] = useState(null), [triBusy, setTriBusy] = useState(false), [triErr, setTriErr] = useState('');
  useEffect(() => { setTri(null); }, [lang]);   // the review is written in one language
  const runTriage = async () => {
    setTriBusy(true); setTriErr('');
    try { setTri((await api(`/admin/complaints/${id}/triage`, { method: 'POST', body: { language: lang } })).data); }
    catch (e) { setTriErr(e.message); }
    setTriBusy(false);
  };
  useEffect(() => { api(`/admin/complaints/${id}`).then((r) => setD(r.data)).catch((e) => setErr(e.message)); }, [id]);

  const decide = async (outcome) => {
    if (note.trim().length < 10) return setErr('A written decision (10+ characters) is required.');
    setBusy(true); setErr('');
    try {
      const r = await api(`/admin/complaints/${id}/decision`, { method: 'PATCH', body: { outcome, decision_note: note.trim(), proof_confirmed: outcome === 'upheld' && proof } });
      setRes(r.data); onDone();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  if (!d) return <p className="sm">{err || 'Loading details…'}</p>;
  const c = d.complaint, decided = ['upheld', 'rejected'].includes(c.status);
  return (
    <div style={{ marginTop: 10 }}>
      <p>{c.description}</p>
      {c.evidence_urls.length > 0 && <p className="sm">Evidence: {c.evidence_urls.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer">[{i + 1}] </a>)}</p>}
      {c.response_text && <p className="sm"><b>Response{d.responded_late ? ' (late)' : ''}:</b> {c.response_text}</p>}
      {d.order && <p className="sm">Order total {d.order.item_total ?? d.order.total} BDT · payment {d.order.payment_status} · status {d.order.status}</p>}
      <p className="sm">Accused has {d.accused_history.upheld_before} earlier upheld complaint(s){d.accused_history.has_active_badge ? ' and an active badge' : ''}.</p>
      {decided ? <p className="sm"><b>Decision ({c.status}):</b> {c.decision_note}</p> : res ? <p className="sm">Recorded. {res.badge_note || ''}</p> : <>
        <div style={{ border: '2px solid var(--pri)', borderRadius: 14, padding: 14, margin: '12px 0', background: 'linear-gradient(135deg, var(--tint), var(--card))' }}>
          {tri && <>
            <p style={{ margin: '0 0 6px' }}><b>{X.head}</b></p>
            <p style={{ margin: '0 0 8px' }}>{tri.summary}</p>
            <p style={{ margin: '0 0 8px' }}><span className={`badge ${tri.suggestion === 'uphold' ? 'bad' : tri.suggestion === 'reject' ? '' : 'pend'}`}>{X.sug[tri.suggestion]}</span> <span className="sm">{X.conf}: {X.lv[tri.confidence]}</span></p>
            {tri.filer_points.length > 0 && <p className="sm" style={{ margin: '0 0 4px' }}><b>{X.filer}:</b> {tri.filer_points.join(' · ')}</p>}
            {tri.accused_points.length > 0 && <p className="sm" style={{ margin: '0 0 4px' }}><b>{X.accused}:</b> {tri.accused_points.join(' · ')}</p>}
            {tri.missing_evidence.length > 0 && <p className="sm" style={{ margin: '0 0 4px' }}><b>{X.missing}:</b> {tri.missing_evidence.join(' · ')}</p>}
            <p className="sm" style={{ margin: '0 0 8px' }}><b>{X.why}:</b> {tri.reasoning}</p>
            {tri.draft_note && <button type="button" className="btn alt sm2" style={{ marginBottom: 8 }} onClick={() => setNote(tri.draft_note)}>{X.use}</button>}
          </>}
          <button type="button" className="btn sm2" disabled={triBusy} style={{ opacity: triBusy ? 0.6 : 1 }} onClick={runTriage}>{triBusy ? X.busy : tri ? X.again : X.btn}</button>
          {triErr && <p className="err" style={{ margin: '8px 0 0' }}>{triErr}</p>}
          <p className="sm" style={{ margin: '8px 0 0' }}>{X.note}</p>
        </div>
        <textarea placeholder="Written reasoning (required)" value={note} onChange={(e) => setNote(e.target.value)} />
        <label className="sm"><input type="checkbox" checked={proof} onChange={(e) => setProof(e.target.checked)} /> I verified the evidence (needed if a badge may be issued)</label>
        {err && <p className="err">{err}</p>}
        <div className="row g" style={{ justifyContent: 'flex-start', marginTop: 10 }}>
          <button className="btn sm2" disabled={busy} onClick={() => decide('upheld')}>Uphold</button>
          <button className="btn alt sm2" disabled={busy} onClick={() => decide('rejected')}>Reject</button>
        </div>
      </>}
    </div>
  );
}

function Complaints() {
  const [status, setStatus] = useState('open'), [rows, setRows] = useState(null), [err, setErr] = useState(''), [openId, setOpenId] = useState('');
  const load = useCallback(async () => {
    setRows(null); setErr('');
    try { setRows((await api(`/admin/complaints?status=${status}`)).data.complaints); } catch (e) { setErr(e.message); setRows([]); }
  }, [status]);
  useEffect(() => { load(); }, [load]);
  return (
    <>
      <div className="tabs">{['open', 'upheld', 'rejected'].map((s) => <button key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{s[0].toUpperCase() + s.slice(1)}</button>)}</div>
      {err && <p className="err">{err}</p>}
      {rows === null ? <div className="box">Loading…</div> : !rows.length ? <div className="box">No {status} complaints.</div> : rows.map((c) => (
        <div className="box" key={c.id}>
          <div className="rowb"><div><b>Order {String(c.order_id).slice(0, 8).toUpperCase()}</b> · {REASON[c.reason_code] || c.reason_code}
            <p className="sm" style={{ margin: '4px 0 0' }}>{c.filed_by.name || 'User'} ({c.filed_by.role}) vs {c.accused.name || 'User'} ({c.accused.role}) · {day(c.created_at)}</p></div>
            <span className="row g">
              {c.response_overdue && <span className="badge bad">Response overdue</span>}
              <span className={`badge ${c.status === 'submitted' || c.status === 'responded' ? 'pend' : ''}`}>{c.status}</span>
              <button className="btn alt sm2" onClick={() => setOpenId(openId === c.id ? '' : c.id)}>{openId === c.id ? 'Close' : 'Open'}</button></span></div>
          {openId === c.id && <Decide id={c.id} onDone={load} />}
        </div>
      ))}
    </>
  );
}

// ---------------- Refunds ----------------
function Refunds() {
  const [id, setId] = useState(''), [msg, setMsg] = useState(null), [busy, setBusy] = useState(false);
  const refund = async (e) => {
    e.preventDefault();
    if (!window.confirm('Refund this order in full? This cannot be undone.')) return;
    setBusy(true); setMsg(null);
    try { await api(`/admin/orders/${id.trim()}/refund`, { method: 'POST' }); setMsg({ ok: true, text: 'Order refunded.' }); setId(''); }
    catch (x) { setMsg({ ok: false, text: x.message }); }
    setBusy(false);
  };
  return (
    <form className="box form" onSubmit={refund}>
      <h3>Refund an order</h3>
      <p className="sm">Full refund of money still held in escrow (for example after an upheld complaint). Released orders cannot be refunded.</p>
      <input required placeholder="Full order ID" value={id} onChange={(e) => setId(e.target.value)} />
      {msg && <p className={msg.ok ? 'sm' : 'err'}>{msg.text}</p>}
      <button className="btn danger" disabled={busy}>{busy ? 'Refunding…' : 'Refund order'}</button>
    </form>
  );
}

function AdminInner() {
  const [tab, setTab] = useState('Overview');
  return (
    <div className="wrap page"><h1>Admin console</h1><p className="sub">Verification, complaints, reviews, refunds and payouts.</p>
      <div className="tabs">{['Overview', 'Shops', 'Complaints', 'Reviews', 'Refunds', 'Ledger'].map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
      {tab === 'Overview' && <Overview goto={setTab} />}
      {tab === 'Shops' && <Shops />}
      {tab === 'Complaints' && <Complaints />}
      {tab === 'Reviews' && <AdminReviews />}
      {tab === 'Refunds' && <Refunds />}
      {tab === 'Ledger' && <LedgerPanel base="/admin/ledger" title="Platform ledger" />}
    </div>
  );
}

export default function Admin() {
  return <RequireAuth role="admin"><AdminInner /></RequireAuth>;
}