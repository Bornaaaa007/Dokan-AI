'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function Login() {
  const [step, setStep] = useState(0), [role, setRole] = useState('Customer'), [ph, setPh] = useState('');
  return (
    <div className="wrap page" style={{ maxWidth: 480 }}><h1>Welcome to Dokan AI</h1><p className="sub">One phone number can hold both customer and seller profiles.</p>
      <div className="box form wide">
        <div className="opts">{['Customer', 'Seller'].map((r) => <button key={r} className={role === r ? 'on' : ''} onClick={() => setRole(r)}>{r}</button>)}</div>
        {step === 0 ? <><input placeholder="Phone (01XXXXXXXXX)" value={ph} onChange={(e) => setPh(e.target.value)} /><button className="btn" disabled={!/^01\d{9}$/.test(ph)} onClick={() => setStep(1)}>Send OTP</button><button className="btn alt">Continue with Google</button></>
          : <><input placeholder="Enter 6-digit OTP (demo: any)" maxLength={6} /><Link className="btn" href={role === 'Seller' ? '/seller' : '/shop'} style={{ textAlign: 'center' }}>Verify &amp; continue</Link></>}
      </div>
    </div>
  );
}
