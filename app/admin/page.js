'use client';
import { useState } from 'react';
import { useStore } from '../../components/Store';
import { SHOPS } from '../../lib/data';
import RequireAuth from '../../components/RequireAuth';

function AdminInner() {
  const { complaints, setComplaints } = useStore();
  const [tab, setTab] = useState('Dashboard');
  const [ver, setVer] = useState([{ id: 1, name: 'Mim Fashion', doc: 'NID + Facebook page', st: 'Pending' }, { id: 2, name: 'Zara Corner', doc: 'NID (blurry)', st: 'Pending' }]);
  const [dec, setDec] = useState({}), [cfg, setCfg] = useState({ a: 2, b: 3, c: 5 });
  const decide = (id, outcome) => { if (!dec[id]?.trim()) return alert('A written reason is required.'); setComplaints(complaints.map((c) => (c.id === id ? { ...c, status: outcome, reason2: dec[id] } : c))); };
  return (
    <div className="wrap page"><h1>Admin console</h1><p className="sub">Verification, complaints and platform settings.</p>
      <div className="tabs">{['Dashboard', 'Verification', 'Complaints', 'Settings'].map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
      {tab === 'Dashboard' && <div className="kpis"><div><b>{SHOPS.length}</b><span>Sellers</span></div><div><b>{ver.filter((v) => v.st === 'Pending').length}</b><span>Pending verifications</span></div><div><b>{complaints.filter((c) => c.status === 'Submitted').length}</b><span>Open complaints</span></div><div><b>48h</b><span>Escrow window</span></div></div>}
      {tab === 'Verification' && ver.map((v) => <div className="box rowb" key={v.id}><div><b>{v.name}</b><br /><span className="sm">{v.doc}</span></div>{v.st === 'Pending' ? <span className="row g"><button className="btn sm2" onClick={() => setVer(ver.map((x) => (x.id === v.id ? { ...x, st: 'Approved' } : x)))}>Approve</button><button className="btn danger sm2" onClick={() => setVer(ver.map((x) => (x.id === v.id ? { ...x, st: 'Rejected' } : x)))}>Reject</button></span> : <span className="badge">{v.st}</span>}</div>)}
      {tab === 'Complaints' && complaints.map((c) => <div className="box" key={c.id}><div className="rowb"><h3 style={{ margin: 0 }}>Complaint #{c.id} · Order {c.orderId}</h3><span className={`badge ${c.status === 'Submitted' ? 'pend' : ''}`}>{c.status}</span></div>
        <p className="sm"><b>{c.by}</b> vs <b>{c.against}</b> · {c.reason}</p><p>{c.text}</p>
        {c.status === 'Submitted' ? <><textarea placeholder="Written reasoning (required)" value={dec[c.id] || ''} onChange={(e) => setDec({ ...dec, [c.id]: e.target.value })} /><div className="row g" style={{ justifyContent: 'flex-start', marginTop: 10 }}>{['Upheld', 'Partially upheld', 'Rejected'].map((o) => <button key={o} className="btn sm2" onClick={() => decide(c.id, o)}>{o}</button>)}</div></> : <p className="sm">Decision recorded: {c.reason2}{c.status.includes('pheld') && ' · Badge issued (expires in 3–6 months), appeal window 7 days.'}</p>}</div>)}
      {tab === 'Settings' && <div className="box form"><h3>Commission bands</h3>{[['a', '< 500 BDT'], ['b', '500–999 BDT'], ['c', '1,000+ BDT']].map(([k, l]) => <label key={k}>{l} (%)<input type="number" value={cfg[k]} onChange={(e) => setCfg({ ...cfg, [k]: e.target.value })} /></label>)}<h3>Premium plans</h3><p className="sm">1 month 1,000 · 3 months 2,500 · 6 months 5,000 BDT</p><button className="btn">Save settings</button></div>}
    </div>
  );
}

export default function Admin() {
  return <RequireAuth role="admin"><AdminInner /></RequireAuth>;
}