'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [role, setRole] = useState('customer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setInfo(''); setBusy(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name, role } },
        });
        if (error) throw error;
        if (!data.session) {
          setInfo('Account created. Check your email to confirm, then log in.');
          setMode('login');
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.push(role === 'seller' ? '/seller' : '/shop');
      router.refresh();
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const isSignup = mode === 'signup';
  const valid = email.includes('@') && password.length >= 6 && (!isSignup || name.trim().length > 1);

  return (
    <div className="wrap page" style={{ maxWidth: 480 }}>
      <h1>{isSignup ? 'Create your account' : 'Welcome back'}</h1>
      <p className="sub">One email can hold both customer and seller profiles.</p>
      <form className="box form wide" onSubmit={submit}>
        {isSignup && (
          <>
            <div className="opts">
              {['customer', 'seller'].map((r) => (
                <button type="button" key={r} className={role === r ? 'on' : ''} onClick={() => setRole(r)}>
                  {r === 'customer' ? 'Customer' : 'Seller'}
                </button>
              ))}
            </div>
            <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          </>
        )}
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" placeholder="Password (min 6 characters)" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p style={{ color: '#c0392b', margin: 0 }}>{error}</p>}
        {info && <p style={{ color: '#1e8449', margin: 0 }}>{info}</p>}
        <button className="btn" type="submit" disabled={!valid || busy}>
          {busy ? 'Please wait…' : isSignup ? 'Sign up' : 'Log in'}
        </button>
        <button type="button" className="btn alt" onClick={() => { setMode(isSignup ? 'login' : 'signup'); setError(''); setInfo(''); }}>
          {isSignup ? 'I already have an account' : 'Create a new account'}
        </button>
      </form>
    </div>
  );
}