'use client';
// Home page section that introduces the Shop the Look feature and links to /look.
import Link from 'next/link';
import { useLang } from './LangProvider';

const TXT = {
  en: {
    tag: '✨ New · AI Look Finder', title: 'Shop the Look',
    sub: 'Saw an outfit on Facebook or WhatsApp? Drop the photo and Dokan AI finds each piece in verified Bangladeshi shops, in seconds.',
    steps: [['📸', 'Upload a photo', 'A screenshot works great.'], ['🔍', 'AI spots every piece', 'Sari, shoes, jewelry, one by one.'], ['🛍️', 'Get real matches', 'In-stock items from verified sellers.']],
    cta: 'Try Shop the Look', privacy: '🔒 Photos are analysed by AI and never saved.',
    photo: 'Your photo', found: '3 pieces found', total: 'Whole look',
    pieces: [['#8a1538', 'Maroon silk sari', 'Great match'], ['#c9a227', 'Gold jhumka earrings', 'Good match'], ['#2b2b3a', 'Black block heels', 'Similar style']],
  },
  bn: {
    tag: '✨ নতুন · এআই লুক ফাইন্ডার', title: 'লুকটা কিনুন',
    sub: 'ফেসবুক বা হোয়াটসঅ্যাপে পছন্দের পোশাক দেখেছেন? ছবি দিন, Dokan AI ভেরিফাইড দোকান থেকে প্রতিটি পোশাক কয়েক সেকেন্ডে খুঁজে দেবে।',
    steps: [['📸', 'ছবি আপলোড করুন', 'স্ক্রিনশটও চলবে।'], ['🔍', 'এআই প্রতিটি পোশাক চেনে', 'শাড়ি, জুতা, গয়না, একটি একটি করে।'], ['🛍️', 'আসল পণ্য পান', 'ভেরিফাইড বিক্রেতার স্টকে থাকা পণ্য।']],
    cta: 'লুকটা কিনুন ব্যবহার করুন', privacy: '🔒 ছবি এআই দিয়ে বিশ্লেষণ হয়, সংরক্ষণ করা হয় না।',
    photo: 'আপনার ছবি', found: '৩টি পোশাক পাওয়া গেছে', total: 'পুরো লুক',
    pieces: [['#8a1538', 'মেরুন সিল্ক শাড়ি', 'দারুণ মিল'], ['#c9a227', 'সোনালি ঝুমকা', 'ভালো মিল'], ['#2b2b3a', 'কালো ব্লক হিল', 'কাছাকাছি স্টাইল']],
  },
};

export default function HomeShopTheLook() {
  const { lang } = useLang();
  const t = TXT[lang] ?? TXT.en;
  return (
    <section id="shop-the-look" className="sec"><div className="wrap grid2">
      <div>
        <span className="stl-tag">{t.tag}</span>
        <h2 style={{ marginTop: 14 }}>{t.title}</h2>
        <p className="sub">{t.sub}</p>
        <div className="stl-steps" style={{ gridTemplateColumns: '1fr', marginTop: 0 }}>
          {t.steps.map(([ic, h, p]) => (
            <div key={h} className="stl-step" style={{ display: 'flex', gap: 14, alignItems: 'center', textAlign: 'left' }}>
              <span className="stl-step-ic" style={{ margin: 0, flex: 'none' }}>{ic}</span>
              <div><b>{h}</b><p className="sm">{p}</p></div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 22 }}><Link className="btn" href="/look">{t.cta}</Link></div>
        <p className="sm" style={{ marginTop: 12 }}>{t.privacy}</p>
      </div>
      <div className="phone" aria-hidden="true">
        <div className="rowb sm"><b>{t.photo}</b><span>{t.found}</span></div>
        <div className="stl-frame scan" style={{ width: '100%', height: 150, margin: '10px 0', background: 'linear-gradient(135deg,#f3e3ea,#e9d6a4)' }} />
        {t.pieces.map(([c, n, m]) => (
          <div className="mini" key={n}><i style={{ background: c }} /><span>{n}<em>{m}</em></span></div>
        ))}
      </div>
    </div></section>
  );
}
