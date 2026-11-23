'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';
import { useAuth } from './AuthProvider';

const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', year: 'numeric' });
const MINE = {
  pending: 'Thanks! Your review is waiting for admin approval.',
  approved: 'Your review is live on the home page. Thank you!',
  hidden: 'Your review was not published.',
};

function ReviewForm({ onDone }) {
  const [rating, setRating] = useState(0), [text, setText] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const send = async (e) => {
    e.preventDefault(); setErr('');
    if (!rating) { setErr('Choose a star rating.'); return; }
    setBusy(true);
    try { await api('/reviews', { method: 'POST', body: { rating, body: text.trim() } }); onDone(); }
    catch (x) { setErr(x.message); }
    setBusy(false);
  };
  return (
    <form className="box form" onSubmit={send} style={{ marginTop: 20 }}>
      <h3>Rate Dokan AI</h3>
      <div className="opts" role="radiogroup" aria-label="Star rating">
        {[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} className={rating === n ? 'on' : ''} aria-pressed={rating === n} onClick={() => setRating(n)}>{n} ★</button>)}
      </div>
      <textarea required minLength={10} maxLength={500} placeholder="What do you think of Dokan AI? (10 to 500 characters)" value={text} onChange={(e) => setText(e.target.value)} />
      <p className="note">Only your first name and last initial are shown, and only after an admin approves it. One review per account.</p>
      {err && <p className="err">{err}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Sending…' : 'Send review'}</button>
    </form>
  );
}

export default function PlatformReviews() {
  const { user, loading } = useAuth();
  const [data, setData] = useState(null), [mine, setMine] = useState(undefined), [failed, setFailed] = useState(false);

  useEffect(() => {
    api('/reviews').then((r) => setData(r.data)).catch(() => setFailed(true));
  }, []);
  const loadMine = useCallback(() => {
    if (!user) { setMine(undefined); return; }
    api('/reviews/mine').then((r) => setMine(r.data.review)).catch(() => setMine(undefined));
  }, [user]);
  useEffect(() => { loadMine(); }, [loadMine]);

  if (failed) return null;   // never show a broken box on the home page
  const reviews = data?.reviews ?? [], s = data?.summary;
  return (
    <section id="reviews" className="sec"><div className="wrap">
      <h2>What people say about Dokan AI</h2>
      {s?.count > 0
        ? <p className="sub"><b>{stars(Math.round(s.average))}</b> {s.average} out of 5 · {s.count} review{s.count > 1 ? 's' : ''}</p>
        : <p className="sub">No reviews yet. Be the first to share your experience.</p>}
      {reviews.length > 0 && <div className="cards4 three">{reviews.map((r) => (
        <article key={r.id}><div className="ic" aria-label={`${r.rating} out of 5`}>{stars(r.rating)}</div><p>{r.body}</p><p className="sm"><b>{r.name}</b> · {day(r.created_at)}</p></article>
      ))}</div>}

      {!loading && !user && <p className="sm" style={{ marginTop: 16 }}><Link href="/login">Log in</Link> to write a review.</p>}
      {user && mine === null && <ReviewForm onDone={loadMine} />}
      {user && mine && <div className="box" style={{ marginTop: 20 }}><b>Your review: {stars(mine.rating)}</b><p className="sm">{mine.body}</p><p className="sm">{MINE[mine.status]}</p></div>}
    </div></section>
  );
}
