'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useStore } from '../../components/Store';

function Form() {
  const sp = useSearchParams(), { complaints, setComplaints } = useStore();
  const [f, setF] = useState({ orderId: sp.get('order') || '', reason: 'Item never delivered', text: '' }), [done, setDone] = useState(false);
  const submit = (e) => { e.preventDefault(); setComplaints([...complaints, { id: complaints.length + 1, ...f, by: 'Customer', against: 'Seller', status: 'Submitted' }]); setDone(true); };
  if (done) return <div className="box"><h3>Complaint submitted ✓</h3><p className="sm">Payment stays in escrow. The seller has 48 hours to respond; an admin will review both sides and record a written decision. You can appeal once within 7 days.</p></div>;
  return (
    <form className="form" onSubmit={submit}>
      <input required placeholder="Order ID" value={f.orderId} onChange={(e) => setF({ ...f, orderId: e.target.value })} />
      <select value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })}>{['Item never delivered', 'Item differs from photos or description', 'Cheap quality substitute', 'Wrong size sent', 'Seller unreachable'].map((x) => <option key={x}>{x}</option>)}</select>
      <textarea required placeholder="Describe what happened" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
      <label>Evidence (photos / video / chat screenshots)<input type="file" multiple /></label>
      <p className="note">A fraud badge is never automatic: only an admin can issue one after verifying evidence.</p>
      <button className="btn">Submit complaint</button>
    </form>
  );
}
export default function Page() { return <div className="wrap page"><h1>Report a problem</h1><p className="sub">Reviews and complaints are separate. Complaints are admin-verified.</p><Suspense><Form /></Suspense></div>; }
