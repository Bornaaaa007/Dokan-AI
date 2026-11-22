'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// DEMO ONLY: replace with a real call to your backend (POST /api/auth/login, then verify the 2FA code).
const DEMO = { email: 'admin@dokan.ai', password: 'Admin@123', code: '123456' };

export default function AdminLogin() {
  const r = useRouter();
  const [step, setStep] = useState('creds'), [email, setEmail] = useState(''), [pw, setPw] = useState(''), [show, setShow] = useState(false);
  const [code, setCode] = useState(['', '', '', '', '', '']), [err, setErr] = useState(''), [fails, setFails] = useState(0), [lock, setLock] = useState(0);
  const boxes = useRef([]);

  useEffect(() => { if (lock <= 0) return; const t = setTimeout(() => setLock(lock - 1), 1000); return () => clearTimeout(t); }, [lock]);

  const fail = (msg) => {
    const n = fails + 1; setFails(n);
    if (n >= 5) { setLock(30); setFails(0); setErr('Too many attempts. Try again in 30 seconds.'); } else setErr(msg);
  };
  const login = (e) => {
    e.preventDefault(); if (lock > 0) return;
    if (email.trim().toLowerCase() === DEMO.email && pw === DEMO.password) { setErr(''); setStep('2fa'); setTimeout(() => boxes.current[0]?.focus(), 50); }
    else fail('Incorrect email or password.');
  };
  const type = (i, v) => { if (!/^\d?$/.test(v)) return; const c = [...code]; c[i] = v; setCode(c); if (v && i < 5) boxes.current[i + 1]?.focus(); };
  const key = (i, e) => { if (e.key === 'Backspace' && !code[i] && i > 0) boxes.current[i - 1]?.focus(); };
  const verify = (e) => {
    e.preventDefault(); if (lock > 0) return;
    if (code.join('') === DEMO.code) {
      try { sessionStorage.setItem('dokan_admin', '1'); } catch {}
      setStep('done'); setTimeout(() => r.push('/admin'), 900);
    } else { setCode(['', '', '', '', '', '']); boxes.current[0]?.focus(); fail('Invalid authentication code.'); }
  };

  return (
    <div className="auth admin-auth">
      <aside className="auth-brand">
        <Link href="/" className="logo">Dokan<b>AI</b></Link>
        <h2>Admin console</h2>
        <ul>
          <li><b>Verification</b>Review seller documents and approve shops.</li>
          <li><b>Complaints</b>Decide cases fairly, with written reasons.</li>
          <li><b>Platform settings</b>Commission, plans and moderation.</li>
        </ul>
        <p className="sm" style={{ color: '#fff', opacity: 0.8 }}>Authorized staff only. All activity is logged.</p>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          {step === 'creds' && (
            <form onSubmit={login}>
              <span className="badge pend" style={{ justifySelf: 'start' }}>🔒 Staff access</span>
              <h1>Admin sign in</h1>
              <p className="sub">Use your Dokan AI staff account.</p>
              <label>Work email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@dokan.ai" autoComplete="username" required /></label>
              <label>Password
                <div className="pfx"><input type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" autoComplete="current-password" required style={{ paddingLeft: 12 }} />
                  <button type="button" className="link" onClick={() => setShow(!show)} style={{ padding: '0 12px' }}>{show ? 'Hide' : 'Show'}</button></div>
              </label>
              {err && <p className="err">{err}</p>}
              <button className="btn" disabled={lock > 0} style={{ opacity: lock > 0 ? 0.5 : 1 }}>{lock > 0 ? `Locked (${lock}s)` : 'Continue'}</button>
              <p className="note">Demo login: admin@dokan.ai / Admin@123</p>
              <p className="note" style={{ textAlign: 'center' }}><Link href="/login">← Back to customer login</Link></p>
            </form>
          )}

          {step === '2fa' && (
            <form onSubmit={verify}>
              <h1>Two-factor check</h1>
              <p className="sub">Enter the 6-digit code from your authenticator app. Two-factor is required for all staff accounts.</p>
              <div className="otp">
                {code.map((c, i) => <input key={i} ref={(el) => (boxes.current[i] = el)} value={c} inputMode="numeric" maxLength={1} onChange={(e) => type(i, e.target.value)} onKeyDown={(e) => key(i, e)} aria-label={`Digit ${i + 1}`} />)}
              </div>
              {err && <p className="err">{err}</p>}
              <button className="btn" disabled={lock > 0} style={{ opacity: lock > 0 ? 0.5 : 1 }}>{lock > 0 ? `Locked (${lock}s)` : 'Verify & sign in'}</button>
              <button type="button" className="link" onClick={() => { setStep('creds'); setErr(''); }}>← Use a different account</button>
              <p className="note">Demo code: 123456</p>
            </form>
          )}

          {step === 'done' && (
            <div className="done"><div className="tick">✓</div><h1>Verified</h1><p className="sub">Opening the admin console…</p></div>
          )}
        </div>
      </main>
    </div>
  );
}