'use client';
import { useState } from 'react';
import { api } from '../lib/api';
import { bdt } from '../lib/data';

const PLANS = [{ months: 1, price: 1000 }, { months: 3, price: 2500 }, { months: 6, price: 5000 }];

// Premium purchase screen for the seller dashboard. Sandbox payment only.
export default function PremiumPanel({ shop, onSaved }) {
  const [busy, setBusy] = useState(0), [msg, setMsg] = useState(null);
  const isPremium = shop.plan === 'premium';

  const buy = async (months) => {
    setBusy(months); setMsg(null);
    try {
      await api(`/shops/${shop.id}/premium`, { method: 'POST', body: { months } });
      const fresh = await api(`/shops/${shop.id}`);        // reload so the plan and expiry are exact
      onSaved && onSaved(fresh.data);
      setMsg({ ok: true, text: `Premium activated for ${months} month${months > 1 ? 's' : ''} (sandbox payment).` });
    } catch (e) { setMsg({ ok: false, text: e.message }); }
    setBusy(0);
  };

  return (
    <div>
      <div className="banner" style={{ borderRadius: 10, marginBottom: 14 }}>Sandbox: no real payment is taken.</div>
      <h3>Premium plan</h3>
      <p className="sm">
        {isPremium
          ? `You are on Premium${shop.plan_expires_at ? ' until ' + new Date(shop.plan_expires_at).toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', year: 'numeric' }) : ''}. Buying more extends it.`
          : 'You are on the Free plan.'}
      </p>
      <p className="sm">Premium gives you: shown first in search results, full AI analytics and tips.</p>
      {msg && <p className={msg.ok ? 'sm' : 'err'}>{msg.text}</p>}
      <div className="kpis">
        {PLANS.map((p) => (
          <div key={p.months}>
            <b>{p.months} month{p.months > 1 ? 's' : ''}</b>
            <span>{bdt(p.price)}</span>
            <button className="btn sm2" style={{ marginTop: 10 }} disabled={!!busy} onClick={() => buy(p.months)}>{busy === p.months ? 'Processing…' : isPremium ? 'Extend' : 'Buy'}</button>
          </div>
        ))}
      </div>
    </div>
  );
}