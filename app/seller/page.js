'use client';
import { useCallback, useEffect, useState } from 'react';
import RequireAuth from '../../components/RequireAuth';
import { useAuth } from '../../components/AuthProvider';
import { useLang } from '../../components/LangProvider';
import ShopSetup from '../../components/ShopSetup';
import SellerOrders, { useSellerOrders } from '../../components/SellerOrders';
import SellerProducts from '../../components/SellerProducts';
import LedgerPanel from '../../components/LedgerPanel';
import PremiumPanel from '../../components/PremiumPanel';
import { api } from '../../lib/api';
import { bdt } from '../../lib/data';

const pct = (r) => (r == null ? '—' : (r * 100).toFixed(1) + '%');
const stockOf = (p) => (p.variants || []).reduce((t, v) => t + (v.stock > 0 ? v.stock : 0), 0);
const VERIFY = { verified: ['✓ Verified', ''], pending: ['Pending review', 'pend'], rejected: ['Rejected', 'bad'] };

// ---------------- the dashboard (only shown once the shop exists) ----------------
function Dashboard({ shop, setShop }) {
  const [tab, setTab] = useState('Overview');
  const { orders, error: oerr, busy, setStatus } = useSellerOrders();
  const [products, setProducts] = useState(null);
  const [perr, setPerr] = useState('');
  const [ledger, setLedger] = useState(null);

  // Analytics: sent with the login token by api(); a seller always gets their own shop.
  const [data, setData] = useState(null), [aload, setAload] = useState(false), [aerr, setAerr] = useState('');
  const [previewFree, setPreviewFree] = useState(false);

  // AI analysis: Gemini reads this shop's numbers (rebuilt on the server) and writes a short coaching note.
  const { lang } = useLang();
  const A = AI_TXT[lang] ?? AI_TXT.en;
  const [ai, setAi] = useState(null), [aiBusy, setAiBusy] = useState(false), [aiErr, setAiErr] = useState('');
  useEffect(() => { setAi(null); }, [lang]);   // tips are written in one language: clear them when the language changes
  const generateAi = async () => {
    setAiBusy(true); setAiErr('');
    try {
      const r = await api('/seller/analytics/ai', { method: 'POST', body: { language: lang } });
      setAi(r.data);
    } catch (e) { setAiErr(e.message); }
    setAiBusy(false);
  };

  useEffect(() => {
    api('/products/mine').then((r) => setProducts(r.data)).catch((e) => { setPerr(e.message); setProducts([]); });
    api('/seller/ledger').then((r) => setLedger(r.data.summary)).catch(() => setLedger(null));
  }, []);

  const loadAnalytics = useCallback(() => {
    setAload(true); setAerr('');
    api('/seller/analytics').then((r) => setData(r.data)).catch((e) => { setData(null); setAerr(e.message); }).finally(() => setAload(false));
  }, []);
  useEffect(() => { if (tab === 'Analytics' && !data && !aload && !aerr) loadAnalytics(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const premium = !!data && !data.locked && !previewFree;
  const [vLabel, vClass] = VERIFY[shop.verification_status] || VERIFY.pending;
  const newOrders = (orders || []).filter((o) => o.status === 'placed').length;
  const lowStock = (products || []).filter((p) => p.status === 'active' && stockOf(p) < 10).length;

  return (
    <div className="wrap page">
      <div className="rowb">
        <div><h1>{shop.name}</h1>
          <span className={`badge ${vClass}`}>{vLabel}</span> <span className="badge">{shop.plan === 'premium' ? 'Premium' : 'Free plan'}</span></div>
        {tab === 'Analytics' && data && !data.locked && <button className="btn alt" onClick={() => setPreviewFree(!previewFree)}>{previewFree ? 'Back to Premium view' : 'Preview Free plan'}</button>}
      </div>

      {shop.verification_status === 'pending' && <div className="box">⏳ Your shop is waiting for admin verification. You can add products and manage orders now. Customers see your products in the shop once you are verified.</div>}
      {shop.verification_status === 'rejected' && <div className="box"><b>Your shop was rejected.</b>{shop.rejection_note ? ` Reason: ${shop.rejection_note}` : ''}<br /><span className="sm">Fix the details in the Shop profile tab and save to send it for review again.</span></div>}

      <div className="tabs">{['Overview', 'Products', 'Orders', 'Earnings', 'Analytics', 'Premium', 'Shop profile'].map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}{t === 'Orders' && newOrders > 0 ? ` (${newOrders})` : ''}</button>)}</div>

      {tab === 'Overview' && <>
        <div className="kpis">
          <div><b>{orders ? orders.length : '…'}</b><span>Orders</span></div>
          <div><b>{ledger ? bdt(ledger.item_total) : '—'}</b><span>Sales (paid orders)</span></div>
          <div><b>{ledger ? bdt(ledger.in_escrow) : '—'}</b><span>In escrow (released after delivery)</span></div>
          <div><b>{ledger ? bdt(ledger.commission_booked) : '—'}</b><span>Platform commission</span></div>
          <div><b>{ledger ? bdt(ledger.paid_to_sellers) : '—'}</b><span>Paid out to you</span></div>
        </div>
        <div className="box"><h3>To do</h3>
          <p className="sm">{newOrders} new order(s) waiting · {lowStock} low-stock product(s) · {(products || []).filter((p) => p.status === 'hidden').length} hidden product(s)</p>
        </div>
        <p className="sm">Sandbox payments only. No real money moves.</p>
      </>}

      {tab === 'Products' && (products === null ? <div className="box">Loading products…</div> : <>
        {perr && <p className="err">{perr}</p>}
        <SellerProducts products={products} setProducts={setProducts} shop={shop} />
      </>)}

      {tab === 'Orders' && <SellerOrders orders={orders} error={oerr} busy={busy} setStatus={setStatus} />}
      {tab === 'Earnings' && <LedgerPanel base="/seller/ledger" title="My earnings" />}

      {tab === 'Premium' && <PremiumPanel shop={shop} onSaved={(s) => setShop(s)} />}
      {tab === 'Analytics' && <div>
        {aload && <div className="box">Loading analytics…</div>}
        {aerr && <div className="box">⚠ {aerr}</div>}
        {data && <>
          {!premium && <div className="box">🔒 Full AI analytics are Premium. Showing basic stats only.</div>}
          <div className="kpis">
            <div><b>{data.summary.views_30d.toLocaleString('en-US')}</b><span>Views (30d)</span></div>
            <div><b>{data.summary.purchases_30d}</b><span>Purchases (30d)</span></div>
            <div><b>{pct(data.summary.conversion)}</b><span>Conversion</span></div>
            <div><b>{data.summary.best_seller?.name || '—'}</b><span>Best seller</span></div>
            {data.shop.top_seller_rank && <div><b>#{data.shop.top_seller_rank}</b><span>Top seller rank</span></div>}
          </div>
          {premium && <>
            <div style={{ border: '2px solid var(--pri)', borderRadius: 16, padding: 18, marginBottom: 16, background: 'linear-gradient(135deg, var(--tint), var(--card))', boxShadow: '0 4px 16px rgba(122, 31, 69, 0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <strong style={{ fontSize: 17 }}>{A.title}</strong>
                <span className="badge pend">NEW</span>
              </div>
              {!ai && <p className="sm" style={{ margin: '0 0 12px' }}>{A.intro}</p>}
              {ai && <>
                <p style={{ fontWeight: 700, fontSize: 17, margin: '0 0 6px' }}>{ai.headline}</p>
                <p style={{ margin: '0 0 12px' }}>{ai.summary}</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px', display: 'grid', gap: 10 }}>
                  {ai.actions.map((a, i) => (
                    <li key={i} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px' }}>
                      <span className={`badge ${a.priority === 'high' ? 'bad' : a.priority === 'medium' ? 'pend' : ''}`}>{A.prio[a.priority] ?? a.priority}</span> <b>{a.title}</b>
                      <div style={{ marginTop: 4, fontSize: 14.5 }}>{a.text}</div>
                    </li>
                  ))}
                </ul>
                {ai.watch_out && <p className="sm" style={{ margin: '0 0 12px' }}>⚠ {ai.watch_out}</p>}
                {ai.source === 'rules' && <p className="sm" style={{ margin: '0 0 12px' }}>{A.rules}</p>}
              </>}
              <button className="btn" style={{ width: '100%', fontSize: 16, opacity: aiBusy ? 0.6 : 1 }} disabled={aiBusy} onClick={generateAi}>
                {aiBusy ? A.busy : ai ? A.again : A.gen}
              </button>
              {aiErr && <p className="err" style={{ margin: '8px 0 0' }}>{aiErr}</p>}
              <p className="sm" style={{ margin: '8px 0 0' }}>{A.note}</p>
            </div>
            <div className="insights box"><h3>Quick tips</h3>
              {data.insights.length === 0
                ? <p className="sm">Not enough data yet for tips. They appear once your products get views and sales.</p>
                : <ul>{data.insights.map((x, i) => <li key={i}><b>{x.title}</b> {x.text}</li>)}</ul>}
            </div>
            {data.best_products.length > 0 && <div className="box"><h3>Doing well</h3><ul>{data.best_products.map((p) => <li key={p.product_id}>{p.name}: {p.purchases_30d} sales from {p.views_30d} views ({pct(p.conversion)})</li>)}</ul></div>}
            {data.worst_products.length > 0 && <div className="box"><h3>Needs attention</h3><ul>{data.worst_products.map((p) => <li key={p.product_id}>{p.name}: {p.views_30d} views, {p.purchases_30d} sales</li>)}</ul></div>}
            {data.platform?.demand_gap?.length > 0 && <div className="box"><h3>What customers are looking for</h3><ul>{data.platform.demand_gap.map((d, i) => <li key={i}>“{d.name}”: {d.searches_30d} searches, {d.listings} in-stock listing{d.listings === 1 ? '' : 's'}</li>)}</ul></div>}
            {data.platform?.trending_categories?.length > 0 && <div className="box"><h3>Trending this week</h3><ul>{data.platform.trending_categories.map((t) => <li key={t.custom_category}>{t.custom_category}: {t.trending_products} trending product{t.trending_products === 1 ? '' : 's'}</li>)}</ul></div>}
          </>}
        </>}
      </div>}

      {tab === 'Shop profile' && <ShopSetup shop={shop} onSaved={(s) => setShop(s)} />}
    </div>
  );
}

// ---------------- load the shop; if there is none, show the setup form ----------------
function SellerInner() {
  const { profile, refreshProfile } = useAuth();
  const [shop, setShop] = useState(undefined); // undefined = loading, null = no shop yet, 'error' = could not load
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    setErr(''); setShop(undefined);
    (async () => {
      const mine = await api('/shops/mine');
      if (mine.data) return mine.data;
      // Second opinion: /me also knows the user's shop.
      const me = await api('/me');
      return me.data?.shop ? (await api(`/shops/${me.data.shop.id}`)).data : null;
    })().then(setShop).catch((e) => { setErr(e.message); setShop('error'); });
  }, []);
  useEffect(() => { load(); }, [load]);

  if (shop === undefined) return <div className="wrap page"><p className="sub">Loading your shop…</p></div>;
  if (shop === 'error') {
    // Never show "Become a seller" just because loading failed: the shop may exist.
    return <div className="wrap page"><h1>Seller Hub</h1><p className="err">Could not load your shop: {err}</p><button className="btn" onClick={load}>Try again</button></div>;
  }
  if (profile?.roles?.includes('admin')) return <div className="wrap page"><h1>Seller area</h1><p className="sub">Admin accounts cannot own a shop.</p></div>;
  if (!shop) {
    return (
      <div className="wrap page">
        <h1>Become a seller</h1>
        <p className="sub">Open your shop on Dokan AI. It takes a minute.</p>
        <ShopSetup shop={null} onSaved={(s) => { setShop(s); refreshProfile && refreshProfile(); }} />
      </div>
    );
  }
  return <Dashboard shop={shop} setShop={setShop} />;
}

// Text for the AI tips panel (Bangla and English). The tips themselves come from the server in the chosen language.
const AI_TXT = {
  en: { title: '✨ AI tips for your shop', intro: 'AI reads your last 30 days (views, carts, sales, stock and what customers search for) and gives you 3 simple tips for this week.', busy: '✨ AI is analysing your shop…', gen: '✨ Get my 3 tips', again: '✨ Refresh tips', note: 'AI can make mistakes. Check the advice against what you know about your shop.', rules: 'AI was busy, so these tips come from your numbers directly.', prio: { high: 'high', medium: 'medium', low: 'low' } },
  bn: { title: '✨ আপনার দোকানের জন্য এআই টিপস', intro: 'এআই আপনার গত ৩০ দিনের হিসাব (ভিউ, কার্ট, বিক্রি, স্টক ও ক্রেতারা কী খুঁজছে) দেখে এই সপ্তাহের জন্য ৩টি সহজ টিপস দেয়।', busy: '✨ এআই আপনার দোকান দেখছে…', gen: '✨ আমার ৩টি টিপস দিন', again: '✨ নতুন টিপস নিন', note: 'এআই ভুল করতে পারে। পরামর্শ আপনার দোকানের অবস্থার সাথে মিলিয়ে নিন।', rules: 'এআই ব্যস্ত ছিল, তাই আপনার হিসাব থেকেই সরাসরি এই টিপসগুলো দেওয়া হয়েছে।', prio: { high: 'জরুরি', medium: 'মাঝারি', low: 'পরে' } },
};

export default function Seller() {
  return (
    <RequireAuth>
      <SellerInner />
    </RequireAuth>
  );
}