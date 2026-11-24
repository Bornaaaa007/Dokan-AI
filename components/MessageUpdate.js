'use client';
// Seller Hub: paste a forwarded chat message, preview the price / stock changes, confirm, and (if needed) undo.
import { useState } from 'react';
import { api } from '../lib/api';
import { useLang } from './LangProvider';
import { bdt } from '../lib/data';

const TXT = {
  en: {
    title: 'Update from a chat message',
    intro: 'Copy a message from your Messenger chat (for example "Red katan sari now 2400, only M and L, 3 left") and paste it here. We show what will change. Nothing is saved until you confirm.',
    ph: 'Paste the forwarded message here…',
    check: 'Check message', checking: 'Reading message…',
    price: 'Price', stock: 'Stock',
    pick: 'Which product is this about?', pickNote: 'We were not sure, so please choose:',
    apply: 'Confirm and update', applying: 'Updating…',
    skip: 'Skip this one', unskip: 'Include',
    unmatched: 'No matching product found for:', warnings: 'Please note',
    done: 'Updated', undo: 'Undo', undoing: 'Undoing…', undone: 'Changes undone.',
    clear: 'Clear', empty: 'Paste a message first.', nothing: 'Nothing to update from this message.',
    partial: 'Some updates could not be saved:',
  },
  bn: {
    title: 'চ্যাট মেসেজ থেকে আপডেট',
    intro: 'আপনার মেসেঞ্জার চ্যাট থেকে মেসেজ কপি করে এখানে পেস্ট করুন (যেমন "লাল কাতান শাড়ি এখন ২৪০০, শুধু M আর L, ৩টা আছে")। কী বদলাবে তা আমরা দেখাব। নিশ্চিত না করা পর্যন্ত কিছু সেভ হবে না।',
    ph: 'ফরওয়ার্ড করা মেসেজ এখানে পেস্ট করুন…',
    check: 'মেসেজ দেখুন', checking: 'মেসেজ পড়া হচ্ছে…',
    price: 'দাম', stock: 'স্টক',
    pick: 'এটি কোন পণ্যের কথা?', pickNote: 'আমরা নিশ্চিত নই, তাই বেছে নিন:',
    apply: 'নিশ্চিত করে আপডেট করুন', applying: 'আপডেট হচ্ছে…',
    skip: 'এটি বাদ দিন', unskip: 'যোগ করুন',
    unmatched: 'এগুলোর সাথে কোনো পণ্য মেলেনি:', warnings: 'লক্ষ্য করুন',
    done: 'আপডেট হয়েছে', undo: 'ফিরিয়ে নিন', undoing: 'ফিরিয়ে নেওয়া হচ্ছে…', undone: 'পরিবর্তন ফিরিয়ে নেওয়া হয়েছে।',
    clear: 'মুছুন', empty: 'আগে একটি মেসেজ পেস্ট করুন।', nothing: 'এই মেসেজ থেকে আপডেট করার কিছু পাওয়া যায়নি।',
    partial: 'কিছু আপডেট সেভ করা যায়নি:',
  },
};

const variantLabel = (v) => v.size.toUpperCase() + (v.color ? ` (${v.color})` : '');
const cleanVariants = (vs) => (vs || []).map((v) => ({ size: v.size, ...(v.color ? { color: v.color } : {}), stock: v.stock }));

export default function MessageUpdate({ products, setProducts }) {
  const { lang } = useLang();
  const X = TXT[lang] ?? TXT.en;

  const [text, setText] = useState('');
  const [sent, setSent] = useState('');
  const [selections, setSelections] = useState({});
  const [res, setRes] = useState(null);
  const [skipped, setSkipped] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [undoList, setUndoList] = useState(null);
  const [failed, setFailed] = useState([]);

  const reset = () => { setText(''); setSent(''); setSelections({}); setRes(null); setSkipped({}); setErr(''); setMsg(''); setFailed([]); };

  const preview = async (body, nextSelections) => {
    setBusy(true); setErr(''); setMsg(''); setFailed([]); setUndoList(null);
    try {
      const r = await api('/seller/message-update', { method: 'POST', body });
      setRes(r.data ?? r);
      setSelections(nextSelections);
      setSent(body.text);
    } catch (e) { setErr(e.message); setRes(null); }
    setBusy(false);
  };

  const check = () => {
    if (!text.trim()) return setErr(X.empty);
    setSkipped({});
    preview({ text }, {});
  };

  const choose = (index, productId) => {
    const next = { ...selections, [index]: productId };
    preview({ text: sent, selections: next }, next);
  };

  const toApply = (res?.updates ?? []).filter((u) => u.product_id && u.patch && !skipped[u.index]);

  const patchProduct = async (id, body) => {
    const r = await api(`/products/${id}`, { method: 'PATCH', body });
    setProducts((list) => list.map((x) => (x.id === id ? { ...x, ...r.data } : x)));
  };

  const apply = async () => {
    setBusy(true); setErr(''); setMsg(''); setFailed([]);
    const undo = [], bad = [];
    for (const u of toApply) {
      try {
        await patchProduct(u.product_id, u.patch);
        const back = {};
        if (u.changes.price != null) back.price = u.current.price;
        if (u.changes.variants) back.variants = cleanVariants(u.current.variants);
        undo.push({ id: u.product_id, name: u.name, body: back });
      } catch (e) { bad.push(`${u.name}: ${e.message}`); }
    }
    setBusy(false);
    setFailed(bad);
    if (undo.length) { setUndoList(undo); setMsg(`${X.done}: ${undo.map((u) => u.name).join(', ')}`); setRes(null); setText(''); setSent(''); setSelections({}); setSkipped({}); }
  };

  const undo = async () => {
    setBusy(true); setErr(''); setFailed([]);
    const bad = [];
    for (const u of undoList) {
      try { await patchProduct(u.id, u.body); } catch (e) { bad.push(`${u.name}: ${e.message}`); }
    }
    setBusy(false);
    setFailed(bad);
    if (!bad.length) { setUndoList(null); setMsg(X.undone); }
  };

  return (
    <div className="box">
      <h3>💬 {X.title}</h3>
      <p className="sm">{X.intro}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={X.ph}
        maxLength={2000}
        disabled={busy}
        style={{ width: '100%', minHeight: 110 }}
      />
      <div className="rowb" style={{ marginTop: 10 }}>
        <span className="sm">{text.length}/2000</span>
        <span style={{ display: 'flex', gap: 8 }}>
          {(text || res || msg) && <button className="btn alt sm" onClick={reset} disabled={busy}>{X.clear}</button>}
          <button className="btn sm" onClick={check} disabled={busy || !text.trim()}>{busy && !res ? X.checking : X.check}</button>
        </span>
      </div>

      {err && <p className="err" style={{ marginTop: 10 }}>{err}</p>}

      {msg && (
        <div className="box" style={{ marginTop: 14 }}>
          <b>✓ {msg}</b>
          {undoList && <div style={{ marginTop: 10 }}><button className="btn alt sm" onClick={undo} disabled={busy}>{busy ? X.undoing : X.undo}</button></div>}
        </div>
      )}
      {failed.length > 0 && <div style={{ marginTop: 10 }}><p className="err"><b>{X.partial}</b></p>{failed.map((f, i) => <p key={i} className="err">• {f}</p>)}</div>}

      {res && (
        <div style={{ marginTop: 16 }}>
          {res.updates.length === 0 && <p className="sm">{X.nothing}</p>}

          {res.updates.map((u) => (
            <div key={u.index} className="box" style={{ opacity: skipped[u.index] ? 0.5 : 1 }}>
              {u.needs_confirmation ? (
                <>
                  <b>{X.pick}</b>
                  <p className="sm">“{u.message_name}” — {X.pickNote}</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {u.candidates.map((c) => (
                      <button key={c.product_id} className="chip b" disabled={busy} onClick={() => choose(u.index, c.product_id)}>
                        {c.name} · {bdt(c.price)}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="rowb">
                    <b>{u.name}</b>
                    <button className="btn alt sm2" onClick={() => setSkipped((s) => ({ ...s, [u.index]: !s[u.index] }))} disabled={busy}>
                      {skipped[u.index] ? X.unskip : X.skip}
                    </button>
                  </div>
                  <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                    {u.changes.price != null && (
                      <li>{X.price}: {bdt(u.current.price)} → <b>{bdt(u.changes.price)}</b></li>
                    )}
                    {(u.changes.variants || []).map((v, i) => (
                      <li key={i}>{X.stock} {variantLabel(v)}: {v.was} → <b>{v.stock}</b></li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ))}

          {res.unmatched?.length > 0 && (
            <p className="sm">{X.unmatched} {res.unmatched.map((m) => `“${m}”`).join(', ')}</p>
          )}
          {res.warnings?.length > 0 && (
            <div className="sm" style={{ marginBottom: 10 }}>
              <b>{X.warnings}:</b>
              {res.warnings.map((w, i) => <div key={i}>• {w}</div>)}
            </div>
          )}

          {toApply.length > 0 && (
            <button className="btn" onClick={apply} disabled={busy}>
              {busy ? X.applying : `${X.apply} (${toApply.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}