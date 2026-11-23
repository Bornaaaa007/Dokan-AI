'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';
import { useAuth } from './AuthProvider';

const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', year: 'numeric' });

function ReviewForm({ productUuid, orderId, onDone }) {
  const [rating, setRating] = useState(0), [text, setText] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const send = async (e) => {
    e.preventDefault(); setErr('');
    if (!rating) { setErr('Choose a star rating.'); return; }
    setBusy(true);
    try { await api(`/products/${productUuid}/reviews`, { method: 'POST', body: { order_id: orderId, rating, body: text.trim() } }); onDone(); }
    catch (x) { setErr(x.message); }
    setBusy(false);
  };
  return (
    <form className="box form" onSubmit={send} style={{ marginTop: 16 }}>
      <h3>Review this product</h3>
      <div className="opts" role="radiogroup" aria-label="Star rating">
        {[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} className={rating === n ? 'on' : ''} aria-pressed={rating === n} onClick={() => setRating(n)}>{n} ★</button>)}
      </div>
      <textarea required minLength={10} maxLength={500} placeholder="How were the quality, fit and delivery? (10 to 500 characters)" value={text} onChange={(e) => setText(e.target.value)} />
      <p className="note">You bought this, so your review gets a “Verified purchase” label. Only your first name and last initial are shown.</p>
      {err && <p className="err">{err}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Sending…' : 'Send review'}</button>
    </form>
  );
}

// Reviews on the product page. `product` is the catalog product; only real shop products (with a database id) can have reviews.
export default function ProductReviews({ product }) {
  const uuid = product?.uuid;
  const { user, loading } = useAuth();
  const [data, setData] = useState(null), [mine, setMine] = useState(null), [failed, setFailed] = useState(false);

  const loadList = useCallback(() => {
    if (!uuid) return;
    api(`/products/${uuid}/reviews`).then((r) => { setData(r.data); setFailed(false); }).catch(() => setFailed(true));
  }, [uuid]);
  const loadMine = useCallback(() => {
    if (!uuid || !user) { setMine(null); return; }
    api(`/products/${uuid}/reviews/mine`).then((r) => setMine(r.data)).catch(() => setMine(null));
  }, [uuid, user]);
  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { loadMine(); }, [loadMine]);

  if (!uuid) return <div className="box"><p className="sm">This is a sample product, so it has no reviews.</p></div>;
  if (failed) return <div className="box"><p className="sm">Reviews could not be loaded right now.</p></div>;
  const reviews = data?.reviews ?? [], s = data?.summary;
  const done = () => { loadList(); loadMine(); };
  return (
    <>
      {data === null ? <div className="box"><p className="sm">Loading reviews…</p></div>
        : s?.count > 0 ? <>
          <p className="sub"><b>{stars(Math.round(s.average))}</b> {s.average} out of 5 · {s.count} review{s.count > 1 ? 's' : ''}</p>
          {reviews.map((r) => (
            <div className="box" key={r.id}>
              <div aria-label={`${r.rating} out of 5`}><b>{stars(r.rating)}</b></div>
              <p style={{ margin: '6px 0' }}>{r.body}</p>
              <p className="sm"><b>{r.name}</b> · {day(r.created_at)} · Verified purchase</p>
            </div>
          ))}
        </> : <div className="box"><p className="sm">No reviews yet. Customers can review this product after their order is delivered.</p></div>}

      {!loading && !user && <p className="sm" style={{ marginTop: 12 }}><Link href="/login">Log in</Link> to review a product you received.</p>}
      {user && mine?.eligible_order_id && <ReviewForm productUuid={uuid} orderId={mine.eligible_order_id} onDone={done} />}
      {user && mine && !mine.eligible_order_id && mine.review && <p className="sm" style={{ marginTop: 12 }}>You reviewed this product: {stars(mine.review.rating)}. Thank you!</p>}
    </>
  );
}
