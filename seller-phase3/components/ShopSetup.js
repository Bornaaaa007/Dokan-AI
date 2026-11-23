'use client';
// One form for both: opening a shop (shop = null) and editing it later.
// Needs: POST /api/shops, PATCH /api/shops/:id
import { useState } from 'react';
import { api } from '../lib/api';

const NID = /^(\d{10}|\d{13}|\d{17})$/;

export default function ShopSetup({ shop, onSaved }) {
  const editing = !!shop;
  const [f, setF] = useState({
    name: shop?.name || '', city: shop?.city || '', description: shop?.description || '',
    social_url: shop?.social_url || '', nid_number: '', return_policy: shop?.return_policy || '',
  });
  const [err, setErr] = useState(''), [ok, setOk] = useState(''), [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setOk('');
    const name = f.name.trim(), nid = f.nid_number.replace(/[\s-]/g, ''), social = f.social_url.trim();
    if (name.length < 2) return setErr('Shop name must be at least 2 characters.');
    if (!editing && !NID.test(nid)) return setErr('Enter your NID number (10, 13 or 17 digits). Admins use it to verify your shop.');
    if (nid && !NID.test(nid)) return setErr('NID must have 10, 13 or 17 digits.');
    if (!editing && !social) return setErr('Add your Facebook or Instagram shop page link. Admins use it to verify your shop.');
    if (social && !/^https?:\/\//i.test(social)) return setErr('The social page link must start with http:// or https://');

    const body = { name, city: f.city.trim(), description: f.description.trim(), social_url: social, return_policy: f.return_policy.trim() };
    if (nid) body.nid_number = nid;
    setBusy(true);
    try {
      const res = editing
        ? await api(`/shops/${shop.id}`, { method: 'PATCH', body })
        : await api('/shops', { method: 'POST', body });
      setOk(editing ? 'Saved.' : 'Shop created.');
      setF((x) => ({ ...x, nid_number: '' }));
      onSaved && onSaved(res.data);
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  };

  return (
    <form className="form box wide" onSubmit={submit}>
      <h3>{editing ? 'Shop profile' : 'Open your shop'}</h3>
      {!editing && <p className="sm">Fill this in once. An admin checks your NID and social page, then verifies your shop. You can add products while you wait.</p>}
      <label>Shop name<input required value={f.name} onChange={set('name')} placeholder="e.g. Nilima Boutique" /></label>
      <div className="f2">
        <label>City<input value={f.city} onChange={set('city')} placeholder="e.g. Comilla" /></label>
        <label>Facebook / Instagram page{!editing && ' *'}<input value={f.social_url} onChange={set('social_url')} placeholder="https://facebook.com/yourshop" /></label>
      </div>
      <label>NID number{!editing && ' *'}<input inputMode="numeric" value={f.nid_number} onChange={set('nid_number')}
        placeholder={editing && shop.nid_set ? 'Already on file. Type only to change it' : '10, 13 or 17 digits'} /></label>
      <label>About your shop<textarea value={f.description} onChange={set('description')} placeholder="What do you sell?" /></label>
      <label>Return &amp; exchange policy<textarea value={f.return_policy} onChange={set('return_policy')} placeholder="e.g. Exchange within 3 days if unworn and tags intact." /></label>
      {editing && <p className="sm">Changing the shop name or NID sends a verified shop back to review. Saving a rejected shop sends it back to review.</p>}
      {err && <p className="err">{err}</p>}
      {ok && <p className="sm" style={{ color: 'var(--ok)' }}>{ok}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save profile' : 'Create shop'}</button>
    </form>
  );
}
