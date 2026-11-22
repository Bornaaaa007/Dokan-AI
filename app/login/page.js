'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const phoneOk = (v) => /^01\d{9}$/.test(v);
const emailOk = (v) => /^\S+@\S+\.\S+$/.test(v);

export default function Login() {
  const r = useRouter();
  const [mode, setMode] = useState('login'), [method, setMethod] = useState('phone'), [step, setStep] = useState('form');
  const [role, setRole] = useState('customer'), [name, setName] = useState(''), [id, setId] = useState(''), [terms, setTerms] = useState(false);
  const [code, setCode] = useState(['', '', '', '', '', '']), [left, setLeft] = useState(0), [err, setErr] = useState('');
  const boxes = useRef([]);

  useEffect(() => { if (left <= 0) return; const t = setTimeout(() => setLeft(left - 1), 1000); return () => clearTimeout(t); }, [left]);

  const valid = (method === 'phone' ? phoneOk(id) : emailOk(id)) && (mode === 'login' || (name.trim() && terms));
  const send = (e) => { e?.preventDefault(); if (!valid) return; setErr(''); setStep('otp'); setLeft(30); setCode(['', '', '', '', '', '']); setTimeout(() => boxes.current[0]?.focus(), 50); };
  const type = (i, v) => {
    if (!/^\d?$/.test(v)) return;
    const c = [...code]; c[i] = v; setCode(c);
    if (v && i < 5) boxes.current[i + 1]?.focus();
  };
  const key = (i, e) => { if (e.key === 'Backspace' && !code[i] && i > 0) boxes.current[i - 1]?.focus(); };
  const paste = (e) => { const d = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6); if (!d) return; e.preventDefault(); setCode(d.padEnd(6, ' ').split('').map((x) => x.trim())); boxes.current[Math.min(d.length, 5)]?.focus(); };
  const verify = (e) => {
    e.preventDefault();
    if (code.join('').length < 6) return setErr('Enter the 6-digit code.');
    setStep('done'); setTimeout(() => r.push(role === 'seller' ? '/seller' : '/shop'), 1200);
  };

  return (
    <div className="auth">
      <aside className="auth-brand">
        <Link href="/" className="logo">Dokan<b>AI</b></Link>
        <h2>Your shop. Your stylist. Your trust.</h2>
        <ul>
          <li><b>Shop smarter</b>Complete outfits within your budget, from verified sellers.</li>
          <li><b>Sell with confidence</b>Orders, stock and payouts in one place.</li>
          <li><b>Protected payments</b>Funds stay in escrow until delivery is confirmed.</li>
        </ul>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          {step === 'form' && (
            <form onSubmit={send}>
              <div className="seg" role="tablist">
                {[['login', 'Log in'], ['signup', 'Sign up']].map(([k, l]) => <button type="button" key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{l}</button>)}
              </div>
              <h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
              <p className="sub">{mode === 'login' ? 'Log in to continue.' : 'It takes less than a minute.'}</p>

              {mode === 'signup' && <>
                <div className="roles">
                  {[['customer', '🛍️', 'Customer', 'Shop and get styled'], ['seller', '🏪', 'Seller', 'Open your shop']].map(([k, ic, t, d]) => (
                    <button type="button" key={k} className={role === k ? 'on' : ''} onClick={() => setRole(k)}><span>{ic}</span><b>{t}</b><small>{d}</small></button>
                  ))}
                </div>
                <label>Full name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" /></label>
              </>}

              <div className="opts" style={{ marginBottom: 4 }}>
                {[['phone', 'Phone'], ['email', 'Email']].map(([k, l]) => <button type="button" key={k} className={method === k ? 'on' : ''} onClick={() => { setMethod(k); setId(''); }}>{l}</button>)}
              </div>
              <label>{method === 'phone' ? 'Phone number' : 'Email address'}
                {method === 'phone'
                  ? <div className="pfx"><span>🇧🇩 +880</span><input inputMode="numeric" maxLength={11} placeholder="01XXXXXXXXX" value={id} onChange={(e) => setId(e.target.value.replace(/\D/g, ''))} /></div>
                  : <input type="email" placeholder="you@example.com" value={id} onChange={(e) => setId(e.target.value)} autoComplete="email" />}
              </label>

              {mode === 'signup' && <label className="chk"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} /> <span>I agree to the Terms and Privacy Policy.</span></label>}
              {role === 'seller' && mode === 'signup' && <p className="note">After signup you will verify your business (NID, shop page, payout account) before you can sell.</p>}

              <button className="btn" disabled={!valid} style={{ opacity: valid ? 1 : 0.5 }}>Send code</button>
              <div className="or"><span>or</span></div>
              <button type="button" className="btn alt gbtn"><svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M45 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.5v5.4h7.1c4.2-3.8 6.5-9.5 6.5-15.9z" /><path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-7.1-5.4c-2 1.3-4.5 2.1-7.4 2.1-5.700 0-10.500-3.800-12.200-9H4.500v5.600C8.100 41.100 15.500 46 24 46z" /><path fill="#FBBC05" d="M11.800 28.400c-.4-1.300-.7-2.700-.7-4.400s.3-3 .7-4.400v-5.600H4.500C3 17 2 20.400 2 24s1 7 2.500 10z" /><path fill="#EA4335" d="M24 10.600c3.200 0 6.100 1.100 8.400 3.300l6.300-6.300C34.900 4.100 29.900 2 24 2 15.500 2 8.100 6.900 4.500 14l7.300 5.600c1.700-5.200 6.500-9 12.200-9z" /></svg> Continue with Google</button>
              <p className="note" style={{ textAlign: 'center' }}>Are you staff? <Link href="/admin/login">Admin login</Link></p>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={verify}>
              <h1>Enter the code</h1>
              <p className="sub">We sent a 6-digit code to <b>{method === 'phone' ? `+880 ${id}` : id}</b>. <button type="button" className="link" onClick={() => setStep('form')}>Change</button></p>
              <div className="otp" onPaste={paste}>
                {code.map((c, i) => <input key={i} ref={(el) => (boxes.current[i] = el)} value={c} inputMode="numeric" maxLength={1} onChange={(e) => type(i, e.target.value)} onKeyDown={(e) => key(i, e)} aria-label={`Digit ${i + 1}`} />)}
              </div>
              {err && <p className="err">{err}</p>}
              <button className="btn">Verify &amp; continue</button>
              <p className="note" style={{ textAlign: 'center' }}>{left > 0 ? `Resend code in ${left}s` : <button type="button" className="link" onClick={send}>Resend code</button>}</p>
              <p className="note" style={{ textAlign: 'center' }}>Demo: any 6 digits will work.</p>
            </form>
          )}

          {step === 'done' && (
            <div className="done"><div className="tick">✓</div><h1>You&apos;re in!</h1>
              <p className="sub">{role === 'seller' ? 'Taking you to your seller hub…' : 'Taking you to the shop…'}</p></div>
          )}
        </div>
      </main>
    </div>
  );
}