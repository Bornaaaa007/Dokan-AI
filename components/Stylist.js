'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useStore } from './Store';
import { PRODUCTS } from '../lib/data';
import { track } from '../lib/track';
import { bdt } from '../lib/stylist';
import { askStylist } from '../lib/stylistApi';
import { useLang } from './LangProvider';

const OCCASIONS = [
  ['wedding', 'Wedding'],
  ['interview', 'Interview / formal'],
  ['eid', 'Eid'],
  ['party', 'Party'],
  ['casual', 'Casual'],
];
const AUDIENCES = [
  ['a young woman', 'Woman'],
  ['a man', 'Man'],
  ['a girl (child)', 'Girl (child)'],
  ['a boy (child)', 'Boy (child)'],
  ['an elderly woman', 'Elderly woman'],
  ['an elderly man', 'Elderly man'],
];
const GOOD_STATUS = ['ok'];

const TXT = {
  en: {
    title: 'Meet your AI stylist',
    sub: 'Live AI stylist: it only suggests real in-stock products from verified sellers. Try a tiny budget, a huge one, or something in between.',
    about: 'Tell it the occasion, who the outfit is for and your budget. It builds a complete look, sari or panjabi, shoes and jewelry, from real verified shops and never goes over budget.',
    occasion: 'Occasion', who: 'Who is it for?', budget: 'Total budget (BDT)',
    build: 'Build my outfit', styling: 'Styling…',
    hint: 'Pick an occasion, who it is for and a budget, then press', hintBtn: 'Build my outfit',
    picking: 'Your stylist is picking items…', needBudget: 'Enter your budget in BDT, for example 5000.',
    sizes: 'Sizes', na: 'n/a', was: 'was', flagged: '⚠ seller has a verified-complaint badge', verified: 'Verified seller',
    left: 'Left out', total: 'Bundle total', remaining: 'Remaining', another: 'Show another look',
    addBundle: 'Add bundle to cart', added: 'Added ✓ View cart', splits: (n) => `(splits into ${n} order${n === 1 ? '' : 's'}, one per seller)`,
    missing: (n) => `${n} item(s) could not be added because they are not in the live shop.`,
    starting: 'Realistic starting price', answer: 'Answer the stylist here…', change: 'Ask for changes, e.g. "make it maroon" or "my budget is 8000"', send: 'Send',
    occasions: { wedding: 'Wedding', interview: 'Interview / formal', eid: 'Eid', party: 'Party', casual: 'Casual' },
    audiences: { 'a young woman': 'Woman', 'a man': 'Man', 'a girl (child)': 'Girl (child)', 'a boy (child)': 'Boy (child)', 'an elderly woman': 'Elderly woman', 'an elderly man': 'Elderly man' },
  },
  bn: {
    title: 'আপনার এআই স্টাইলিস্টের সাথে পরিচিত হন',
    sub: 'লাইভ এআই স্টাইলিস্ট: শুধু ভেরিফাইড বিক্রেতাদের স্টকে থাকা আসল পণ্যই সাজেস্ট করে। খুব কম, অনেক বেশি বা মাঝারি, যেকোনো বাজেট দিয়ে দেখুন।',
    about: 'অনুষ্ঠান, কার জন্য পোশাক আর আপনার বাজেট জানান। এআই স্টাইলিস্ট ভেরিফাইড দোকান থেকে শাড়ি বা পাঞ্জাবি, জুতা ও গয়না মিলিয়ে একটি পূর্ণ লুক সাজিয়ে দেবে, বাজেট কখনো ছাড়িয়ে যাবে না। বাংলা বা ইংরেজি, যেভাবে খুশি লিখুন।',
    occasion: 'অনুষ্ঠান', who: 'কার জন্য?', budget: 'মোট বাজেট (টাকা)',
    build: 'আমার পোশাক সাজিয়ে দিন', styling: 'সাজানো হচ্ছে…',
    hint: 'অনুষ্ঠান, কার জন্য ও বাজেট বেছে নিয়ে চাপ দিন', hintBtn: 'আমার পোশাক সাজিয়ে দিন',
    picking: 'আপনার স্টাইলিস্ট পণ্য বাছাই করছে…', needBudget: 'টাকায় আপনার বাজেট লিখুন, যেমন ৫০০০।',
    sizes: 'সাইজ', na: 'নেই', was: 'আগে ছিল', flagged: '⚠ বিক্রেতার বিরুদ্ধে যাচাইকৃত অভিযোগের ব্যাজ আছে', verified: 'ভেরিফাইড বিক্রেতা',
    left: 'বাদ পড়েছে', total: 'মোট দাম', remaining: 'বাকি থাকল', another: 'আরেকটি লুক দেখুন',
    addBundle: 'পুরো লুক কার্টে যোগ করুন', added: 'যোগ হয়েছে ✓ কার্ট দেখুন', splits: (n) => `(${n}টি অর্ডারে ভাগ হবে, প্রতি বিক্রেতার একটি)`,
    missing: (n) => `${n}টি পণ্য কার্টে যোগ করা যায়নি, কারণ সেগুলো এখন দোকানে নেই।`,
    starting: 'বাস্তবসম্মত ন্যূনতম দাম', answer: 'এখানে স্টাইলিস্টকে উত্তর দিন…', change: 'বদলাতে বলুন, যেমন "মেরুন রঙ চাই" বা "বাজেট ৮০০০"', send: 'পাঠান',
    occasions: { wedding: 'বিয়ে', interview: 'ইন্টারভিউ / ফরমাল', eid: 'ঈদ', party: 'পার্টি', casual: 'প্রতিদিনের' },
    audiences: { 'a young woman': 'নারী', 'a man': 'পুরুষ', 'a girl (child)': 'মেয়ে শিশু', 'a boy (child)': 'ছেলে শিশু', 'an elderly woman': 'বয়স্ক নারী', 'an elderly man': 'বয়স্ক পুরুষ' },
  },
};
// Bangla request sent to the stylist so its reply comes back in Bangla (the stylist answers in the language of the message).
const BN_OCC = { wedding: 'বিয়ের অনুষ্ঠানের', interview: 'ইন্টারভিউয়ের', eid: 'ঈদের', party: 'পার্টির', casual: 'প্রতিদিনের' };
const BN_WHO = { 'a young woman': 'একজন নারীর', 'a man': 'একজন পুরুষের', 'a girl (child)': 'একটি মেয়ে শিশুর', 'a boy (child)': 'একটি ছেলে শিশুর', 'an elderly woman': 'একজন বয়স্ক নারীর', 'an elderly man': 'একজন বয়স্ক পুরুষের' };

function swatch(colors) {
  const c = String((colors && colors[0]) || '').toLowerCase().replace(/[\s-]/g, '');
  return typeof CSS !== 'undefined' && c && CSS.supports('color', c) ? c : '#d9d9d9';
}

export default function Stylist() {
  const { lang } = useLang();
  const t = TXT[lang] ?? TXT.en;
  const [occ, setOcc] = useState('wedding');
  const [who, setWho] = useState('a young woman');
  const [budget, setBudget] = useState(5000);
  const [data, setData] = useState(null);      // last response from the stylist
  const [conv, setConv] = useState(null);      // conversation id (the AI remembers earlier messages)
  const [alt, setAlt] = useState(0);           // which look is shown (0 = main, 1+ = alternatives)
  const [added, setAdded] = useState(false);
  const { add } = useStore();
  const [missing, setMissing] = useState(0);

  // Puts every item of the shown look into the real cart (matched by database id).
  const addBundle = () => {
    let skipped = 0;
    look.items.forEach((it) => {
      const p = PRODUCTS.find((x) => x.uuid === it.product_id);
      const size = (p && (p.sizes || []).find((s) => (it.sizes || []).includes(s))) || (it.sizes || [])[0] || (p && p.sizes[0]);
      if (!p || !size) { skipped++; return; }
      add(p.id, size);
      track('add_to_cart', p);
    });
    setMissing(skipped); setAdded(true);
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [chat, setChat] = useState('');

  const send = async (message, conversationId) => {
    setLoading(true); setError(''); setAdded(false);
    try {
      const d = await askStylist({ message, conversationId });
      setData(d); setConv(d.conversation_id); setAlt(0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Form: always starts a fresh conversation
  const run = (b = budget) => {
    const amount = Number(b);
    if (!amount || amount <= 0) { setError(t.needBudget); return; }
    send(lang === 'bn' ? `${BN_WHO[who]} জন্য ${BN_OCC[occ]} পোশাক, বাজেট ${amount} টাকা` : `${occ} outfit for ${who}, budget ${amount} BDT`, null);
  };

  // Follow-up box: continues the same conversation
  const sendChat = (e) => {
    e.preventDefault();
    const m = chat.trim();
    if (!m || loading) return;
    setChat('');
    send(m, conv);
  };

  const bundle = data?.bundle;
  const looks = bundle
    ? [{ items: bundle.items, total: bundle.total, remaining: bundle.remaining }, ...(bundle.alternatives || [])]
    : [];
  const look = looks.length ? looks[alt % looks.length] : null;
  const sellers = look ? new Set(look.items.map((i) => i.shop_id)).size : 0;
  const leftOut = bundle?.left_out || [];
  const replyClass = data && !GOOD_STATUS.includes(data.status) ? 'msg warn' : 'msg';

  return (
    <section id="stylist" className="sec tint"><div className="wrap">
      <h2>{t.title}</h2>
      <p className="sub">{t.sub}</p>
      <p className="lead" style={{ marginTop: -12, marginBottom: 28, fontSize: 16 }}>{t.about}</p>
      <div className="demo grid2">
        <form className="panel" onSubmit={(e) => { e.preventDefault(); run(); }}>
          <label>{t.occasion}
            <select value={occ} onChange={(e) => setOcc(e.target.value)}>
              {OCCASIONS.map(([k, label]) => <option key={k} value={k}>{t.occasions[k] ?? label}</option>)}
            </select>
          </label>
          <label>{t.who}
            <select value={who} onChange={(e) => setWho(e.target.value)}>
              {AUDIENCES.map(([k, label]) => <option key={k} value={k}>{t.audiences[k] ?? label}</option>)}
            </select>
          </label>
          <label>{t.budget}
            <input type="number" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} />
          </label>
          <div className="row g wrapx">
            {[100, 1500, 5000, 100000].map((b) => (
              <button type="button" key={b} className="chip b" disabled={loading}
                onClick={() => { setBudget(b); run(b); }}>{b.toLocaleString('en-IN')}</button>
            ))}
          </div>
          <button className="btn" type="submit" disabled={loading}>{loading ? t.styling : t.build}</button>
        
        </form>

        <div className="panel out" aria-live="polite">
          {!data && !error && !loading && <div className="msg">{t.hint} <b>{t.hintBtn}</b>.</div>}
          {loading && <div className="msg">{t.picking}</div>}
          {error && <div className="msg warn">{error}</div>}

          {data && !loading && <>
            <div className={replyClass} style={{ whiteSpace: 'pre-line' }}>{data.reply}</div>

            {look && look.items.map((it) => (
              <div className="item" key={it.product_id}>
                <i style={{ background: swatch(it.colors) }} />
                <div>
                  <b style={{ whiteSpace: 'normal' }}>{it.name}</b>
                  <small>
                    {it.label} · {it.shop_name} · {t.sizes}: {(it.sizes || []).join(', ') || t.na}
                    {it.original_price ? <> · {t.was} {bdt(it.original_price)}</> : null}
                    {it.seller_flagged ? ` · ${t.flagged}` : ` · ${t.verified}`}
                  </small>
                </div>
                <b>{bdt(it.price)}</b>
              </div>
            ))}

            {look && leftOut.length > 0 && alt === 0 && (
              <div className="msg warn">{t.left}: {leftOut.join(', ')}.</div>
            )}

            {look && <>
              <div className="tot"><span>{t.total}</span><span>{bdt(look.total)}</span></div>
              <div className="tot ok" style={{ border: 0, padding: 0 }}><span>{t.remaining}</span><span>{bdt(look.remaining)}</span></div>
              {looks.length > 1 && (
                <button type="button" className="chip b" onClick={() => { setAlt((alt + 1) % looks.length); setAdded(false); }}>
                  {t.another} ({(alt % looks.length) + 1}/{looks.length})
                </button>
              )}
                            {added
                ? <Link className="btn" href="/cart">{t.added} {t.splits(sellers)}</Link>
                : <button className="btn" type="button" onClick={addBundle}>{t.addBundle}</button>}
              {added && missing > 0 && <div className="msg warn">{t.missing(missing)}</div>}
            </>}

            {!look && data.min_required_total ? (
              <div className="tot"><span>{t.starting}</span><span>{bdt(data.min_required_total)}</span></div>
            ) : null}
          </>}

          {data && (
            <form className="row g" onSubmit={sendChat} style={{ marginTop: 12 }}>
              <input
                value={chat} onChange={(e) => setChat(e.target.value)} disabled={loading}
                placeholder={data.ask ? t.answer : t.change}
                style={{ flex: 1 }}
              />
              <button className="btn" type="submit" disabled={loading || !chat.trim()}>{t.send}</button>
            </form>
          )}
        </div>
      </div>
    </div></section>
  );
}