'use client';
// Shop the look: upload an outfit photo -> AI lists the pieces -> we match each piece to real products.
import { useRef, useState } from 'react';
import Link from 'next/link';
import { PRODUCTS, COLORS, shopOf, bdt } from '../lib/data';
import { api } from '../lib/api';
import { useLang } from './LangProvider';
import { ProductCard } from './ui';
import { matchLook } from '../lib/visual/match.mjs';

const TXT = {
  en: {
    tag: '✨ AI Look Finder', title: 'Shop the Look',
    sub: 'Spot an outfit you love? Drop the photo and we’ll find it in verified Bangladeshi shops, in seconds.',
    drop: 'Drop an outfit photo here', drop2: 'or tap to upload · JPG, PNG or WebP', pick: 'Upload a photo', again: 'Try another photo',
    busy: 'Scanning the outfit…', busySub: 'Spotting every piece and checking verified shops.',
    steps: [['📸', 'Upload', 'A screenshot from Facebook or WhatsApp works great.'], ['🔍', 'AI spots each piece', 'Sari, shoes, jewelry, one by one.'], ['🛍️', 'Get real matches', 'From verified sellers, ranked by fit.']],
    privacy: '🔒 Private: photos are analysed by AI and never saved.',
    found: 'pieces found', why: 'Why it matched', none: 'No close match in our verified shops yet.', stylist: 'Ask the AI Stylist',
    empty: 'We could not see any fashion item in that photo. Try a clearer one.', big: 'Use a JPG, PNG or WebP photo under 10 MB.',
    total: 'Get the whole look', totalSub: 'Top pick for each piece', great: 'Great match', good: 'Good match', similar: 'Similar style',
    warn: '⚠ seller has verified complaints',
  },
  bn: {
    tag: '✨ এআই লুক ফাইন্ডার', title: 'লুকটা কিনুন',
    sub: 'পছন্দের পোশাক দেখেছেন? ছবি দিন, ভেরিফাইড দোকান থেকে কয়েক সেকেন্ডে খুঁজে দেব।',
    drop: 'এখানে পোশাকের ছবি ছেড়ে দিন', drop2: 'অথবা ট্যাপ করে আপলোড করুন · JPG, PNG বা WebP', pick: 'ছবি আপলোড করুন', again: 'আরেকটি ছবি দিন',
    busy: 'পোশাক স্ক্যান হচ্ছে…', busySub: 'প্রতিটি পোশাক চিনে ভেরিফাইড দোকানে মেলানো হচ্ছে।',
    steps: [['📸', 'ছবি দিন', 'ফেসবুক বা হোয়াটসঅ্যাপের স্ক্রিনশটও চলবে।'], ['🔍', 'এআই প্রতিটি পোশাক চেনে', 'শাড়ি, জুতা, গয়না, একটি একটি করে।'], ['🛍️', 'আসল পণ্য পান', 'ভেরিফাইড বিক্রেতাদের কাছ থেকে, মিল অনুযায়ী সাজানো।']],
    privacy: '🔒 গোপনীয়: ছবি এআই দিয়ে বিশ্লেষণ হয়, সংরক্ষণ করা হয় না।',
    found: 'টি পোশাক পাওয়া গেছে', why: 'কেন মিলেছে', none: 'ভেরিফাইড দোকানে এখনো কাছাকাছি কিছু নেই।', stylist: 'এআই স্টাইলিস্টকে জিজ্ঞেস করুন',
    empty: 'ছবিতে কোনো পোশাক দেখা যায়নি। আরও পরিষ্কার ছবি দিন।', big: '১০ MB-এর কম JPG, PNG বা WebP ছবি দিন।',
    total: 'পুরো লুকটা নিন', totalSub: 'প্রতিটি পোশাকের সেরা পছন্দ', great: 'দারুণ মিল', good: 'ভালো মিল', similar: 'কাছাকাছি স্টাইল',
    warn: '⚠ বিক্রেতার বিরুদ্ধে যাচাইকৃত অভিযোগ আছে',
  },
};

// Shrink in the browser (max 1024px) so the upload is small and fast. Returns a preview URL and the base64 text.
async function prepare(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * scale));
  c.height = Math.max(1, Math.round(bmp.height * scale));
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const url = c.toDataURL('image/jpeg', 0.8);
  return { preview: url, base64: url.split(',')[1] };
}

const strength = (score) => (score >= 9 ? 'great' : score >= 6 ? 'good' : 'similar');
const swatch = (c) => COLORS[c] || (/^[a-z]+$/.test(c) ? c : '#cfc6bd');

export default function ShopTheLook() {
  const { lang } = useLang();
  const t = TXT[lang] ?? TXT.en;
  const input = useRef(null);
  const [preview, setPreview] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const [look, setLook] = useState(null), [drag, setDrag] = useState(false);   // look = { summary, groups: [{ item, matches }] }

  const handle = async (file) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 10 * 1024 * 1024) return setErr(t.big);
    setErr(''); setLook(null); setBusy(true);
    try {
      const { preview: url, base64 } = await prepare(file);
      setPreview(url);
      const { data } = await api('/ai/shop-the-look', { method: 'POST', body: { image_base64: base64, mime_type: 'image/jpeg', language: lang } });
      if (!data.items.length) setErr(t.empty);
      setLook({ summary: data.summary, groups: matchLook(data.items, PRODUCTS, { isFlagged: (p) => !!shopOf(p.shop)?.fraud }) });
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  };
  const pick = (e) => { const f = e.target.files?.[0]; if (input.current) input.current.value = ''; handle(f); };
  const drop = (e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files?.[0]); };
  const open = () => input.current?.click();

  const tops = (look?.groups ?? []).map((g) => g.matches[0]?.p).filter(Boolean);
  const total = tops.reduce((s, p) => s + p.price, 0);

  return (
    <div className="wrap page stl">
      <div className="stl-hero">
        <span className="stl-tag">{t.tag}</span>
        <h1>{t.title}</h1>
        <p className="sub">{t.sub}</p>
      </div>

      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={pick} />

      {!preview ? (
        <>
          <div
            className={'stl-drop' + (drag ? ' on' : '')} role="button" tabIndex={0}
            onClick={open} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={drop}
          >
            <div className="stl-drop-ic">📸</div>
            <b>{t.drop}</b>
            <span className="sm">{t.drop2}</span>
            <span className="btn">{t.pick}</span>
          </div>
          <div className="stl-steps">
            {t.steps.map(([ic, h, p], i) => (
              <div key={i} className="stl-step"><span className="stl-step-ic">{ic}</span><b>{h}</b><p className="sm">{p}</p></div>
            ))}
          </div>
        </>
      ) : (
        <div className="box stl-stage">
          <div className={'stl-frame' + (busy ? ' scan' : '')}><img src={preview} alt="Your photo" /></div>
          <div className="stl-side">
            {busy ? (
              <><h3>{t.busy}</h3><p className="sm">{t.busySub}</p></>
            ) : look && (
              <>
                {look.groups.length > 0 && <span className="stl-tag">{look.groups.length} {t.found}</span>}
                {look.summary && <p className="stl-sum">{look.summary}</p>}
                {tops.length > 0 && (
                  <div className="stl-total">
                    <div><b>{t.total}</b><span className="sm">{t.totalSub}</span></div>
                    <strong>{bdt(total)}</strong>
                  </div>
                )}
              </>
            )}
            <button type="button" className="btn alt" disabled={busy} onClick={open}>{t.again}</button>
          </div>
        </div>
      )}

      {err && <p className="err" style={{ marginTop: 12 }}>{err}</p>}
      <p className="sm stl-priv">{t.privacy}</p>

      {look?.groups.map(({ item, matches }, i) => (
        <div key={i} className="box stl-piece stl-in" style={{ animationDelay: `${i * 140}ms` }}>
          <div className="stl-ph">
            <span className="stl-num">{i + 1}</span>
            <div>
              <h3>{item.label || item.custom_category}</h3>
              <div className="stl-tags">
                {item.colors.map((c) => <span key={c} className="chip"><i className="stl-dot" style={{ background: swatch(c) }} />{c}</span>)}
                {[item.category, item.custom_category, ...item.occasions].filter(Boolean).map((x) => <span key={x} className="chip">{x}</span>)}
              </div>
            </div>
          </div>
          {matches.length ? (
            <div className="pgrid">
              {matches.map(({ p, reasons, flagged, score }) => (
                <div key={p.id}>
                  <ProductCard p={p} />
                  <div className="stl-why">
                    <span className={'stl-badge ' + strength(score)}>{t[strength(score)]}</span>
                    <p className="sm">{t.why}: {reasons.join(' · ') || '–'}{flagged ? ` · ${t.warn}` : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : <p>{t.none} <Link href="/stylist" className="link">{t.stylist}</Link></p>}
        </div>
      ))}
    </div>
  );
}