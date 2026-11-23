// Backup for the seller AI tips: when Gemini is down or has no key, build 3 plain-language tips
// from the same numbers with our own rules. Pure function, no network. Supports Bangla ("bn") and English ("en").
const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const num = (n, lang) => (lang === 'bn' ? String(n).replace(/\d/g, (d) => BN_DIGITS[d]) : String(n));

const S = {
  en: {
    gapTitle: 'Stock what customers search for',
    gap: (g, n) => `Customers searched for "${g.name}" ${n(g.searches_30d)} times in 30 days, but ${g.listings === 0 ? 'no shop has it in stock' : `only ${n(g.listings)} in-stock listing${g.listings === 1 ? '' : 's'} exist`}. Stocking it could win these buyers.`,
    restockTitle: 'Restock a seller', restock: (p, n) => `${p.name} sold ${n(p.purchases_30d)} time${p.purchases_30d === 1 ? '' : 's'} in 30 days but is out of stock. Restock it this week.`,
    weakTitle: 'Fix a product nobody buys', weak: (p, n) => `${p.name} got ${n(p.views_30d)} view${p.views_30d === 1 ? '' : 's'} but no sales. Try a lower price or clearer photos.`,
    trendTitle: 'Ride the trend', trend: (c) => `${c.category} is trending this week. Add or promote products in this category.`,
    startTitle: 'Get your first views', start: 'Add clear photos, a short description and sizes to each product so shoppers can find and trust them.',
    headline: 'Three things to do this week', summary: (s, n) => `In the last 30 days your shop had ${n(s.views_30d)} view${s.views_30d === 1 ? '' : 's'} and ${n(s.purchases_30d)} sale${s.purchases_30d === 1 ? '' : 's'}.`,
  },
  bn: {
    gapTitle: 'ক্রেতারা যা খুঁজছে তা স্টকে রাখুন',
    gap: (g, n) => `ক্রেতারা গত ৩০ দিনে “${g.name}” ${n(g.searches_30d)} বার খুঁজেছে, কিন্তু ${g.listings === 0 ? 'কোনো দোকানেই এটি স্টকে নেই' : `স্টকে মাত্র ${n(g.listings)}টি আছে`}। এটি স্টকে রাখলে নতুন ক্রেতা পেতে পারেন।`,
    restockTitle: 'বিক্রি হওয়া পণ্য আবার স্টকে আনুন', restock: (p, n) => `${p.name} গত ৩০ দিনে ${n(p.purchases_30d)} বার বিক্রি হয়েছে, কিন্তু এখন স্টকে নেই। এই সপ্তাহেই আবার স্টক করুন।`,
    weakTitle: 'যে পণ্য কেউ কিনছে না তা ঠিক করুন', weak: (p, n) => `${p.name} ${n(p.views_30d)} বার দেখা হয়েছে, কিন্তু একটিও বিক্রি হয়নি। দাম একটু কমান বা আরও পরিষ্কার ছবি দিন।`,
    trendTitle: 'চলতি ট্রেন্ডে যোগ দিন', trend: (c) => `এই সপ্তাহে “${c.category}” ট্রেন্ডিং। এই ধরনের পণ্য যোগ করুন বা প্রচার করুন।`,
    startTitle: 'প্রথম ভিউ পেতে শুরু করুন', start: 'প্রতিটি পণ্যে পরিষ্কার ছবি, ছোট বর্ণনা ও সাইজ দিন, যাতে ক্রেতারা সহজে খুঁজে পায় ও ভরসা করে।',
    headline: 'এই সপ্তাহে তিনটি কাজ', summary: (s, n) => `গত ৩০ দিনে আপনার দোকান ${n(s.views_30d)} বার দেখা হয়েছে এবং ${n(s.purchases_30d)}টি বিক্রি হয়েছে।`,
  },
};

export function fallbackTips(data, language = 'bn') {
  const lang = language === 'bn' ? 'bn' : 'en';
  const t = S[lang], n = (x) => num(x, lang);
  const picks = [];
  const gaps = data.platform?.demand_gap ?? [];
  const gap = gaps.find((g) => g.signal === 'high_opportunity') ?? gaps[0];
  if (gap) picks.push({ title: t.gapTitle, text: t.gap(gap, n), priority: 'high' });
  const restock = (data.insights ?? []).find((i) => i.type === 'restock' && i.name);
  if (restock) picks.push({ title: t.restockTitle, text: t.restock(restock, n), priority: 'high' });
  const weak = (data.worst_products ?? [])[0];
  if (weak) picks.push({ title: t.weakTitle, text: t.weak(weak, n), priority: 'medium' });
  const trend = (data.platform?.trending_categories ?? [])[0];
  if (trend) picks.push({ title: t.trendTitle, text: t.trend({ category: trend.custom_category }), priority: 'low' });
  if (picks.length < 3) picks.push({ title: t.startTitle, text: t.start, priority: 'medium' });
  return {
    headline: t.headline,
    summary: t.summary(data.summary ?? { views_30d: 0, purchases_30d: 0 }, n),
    actions: picks.slice(0, 3),
    watch_out: '',
  };
}
