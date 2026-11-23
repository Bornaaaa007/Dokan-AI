'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { api } from '../../lib/api';

const emailOk = (v) => /^\S+@\S+\.\S+$/.test(v);

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [role, setRole] = useState('customer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const isSignup = mode === 'signup';
  const valid = emailOk(email) && password.length >= 6 && (!isSignup || (name.trim().length > 1 && terms));
  const reset = (m) => { setMode(m); setError(''); setInfo(''); };

 // Ask the backend who this user is, then send them to the right place
const go = async () => {
  try {
    const { data } = await api('/me');
    const roles = data.roles || [];
    router.push(roles.includes('admin') ? '/admin' : roles.includes('seller') ? '/seller' : '/shop');
  } catch {
    router.push('/shop');
  }
  router.refresh();
};

  const submit = async (e) => {
    e.preventDefault();
    if (!valid) return;
    setError(''); setInfo(''); setBusy(true);
    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name, role } } });
        if (error) throw error;
        if (!data.session) {
          setInfo('Account created. Check your email to confirm, then log in.');
          setMode('login');
          return;
        }
        await go();
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await go();
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/shop` } });
    if (error) setError(error.message);
  };

  const forgot = async () => {
    setError(''); setInfo('');
    if (!emailOk(email)) return setError('Enter your email above first.');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login` });
    if (error) setError(error.message); else setInfo('Password reset link sent. Check your email.');
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
          <form onSubmit={submit}>
            <div className="seg" role="tablist">
              {[['login', 'Log in'], ['signup', 'Sign up']].map(([k, l]) => (
                <button type="button" key={k} className={mode === k ? 'on' : ''} onClick={() => reset(k)}>{l}</button>
              ))}
            </div>
            <h1>{isSignup ? 'Create your account' : 'Welcome back'}</h1>
            <p className="sub">{isSignup ? 'It takes less than a minute.' : 'Log in to continue.'}</p>

            {isSignup && <>
              <div className="roles">
                {[['customer', '🛍️', 'Customer', 'Shop and get styled'], ['seller', '🏪', 'Seller', 'Open your shop']].map(([k, ic, t, d]) => (
                  <button type="button" key={k} className={role === k ? 'on' : ''} onClick={() => setRole(k)}><span>{ic}</span><b>{t}</b><small>{d}</small></button>
                ))}
              </div>
              <label>Full name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" /></label>
            </>}

            <label>Email address<input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
            <label>Password
              <div className="pfx">
                <input type={show ? 'text' : 'password'} placeholder="Min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={isSignup ? 'new-password' : 'current-password'} style={{ paddingLeft: 12 }} />
                <button type="button" className="link" onClick={() => setShow(!show)} style={{ padding: '0 12px' }}>{show ? 'Hide' : 'Show'}</button>
              </div>
            </label>
            {!isSignup && <button type="button" className="link" style={{ justifySelf: 'end', fontSize: 13 }} onClick={forgot}>Forgot password?</button>}

            {isSignup && <label className="chk"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} /> <span>I agree to the Terms and Privacy Policy.</span></label>}
            {isSignup && role === 'seller' && <p className="note">After signup you will verify your business (NID, shop page, payout account) before you can sell.</p>}

            {error && <p className="err">{error}</p>}
            {info && <p style={{ color: 'var(--ok)', margin: 0, fontSize: 14 }}>{info}</p>}

            <button className="btn" type="submit" disabled={!valid || busy} style={{ opacity: !valid || busy ? 0.5 : 1 }}>
              {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Log in'}
            </button>
            <div className="or"><span>or</span></div>
            <button type="button" className="btn alt gbtn" onClick={google}>
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M45 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.5v5.4h7.1c4.2-3.8 6.5-9.5 6.5-15.9z" /><path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-7.1-5.4c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.6C8.1 41.1 15.5 46 24 46z" /><path fill="#FBBC05" d="M11.8 28.4c-.4-1.3-.7-2.7-.7-4.4s.3-3 .7-4.4v-5.6H4.5C3 17 2 20.4 2 24s1 7 2.5 10z" /><path fill="#EA4335" d="M24 10.6c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.1 29.9 2 24 2 15.5 2 8.1 6.9 4.5 14l7.3 5.6c1.7-5.2 6.5-9 12.2-9z" /></svg> Continue with Google
            </button>
            
          </form>
        </div>
      </main>
    </div>
  );
}