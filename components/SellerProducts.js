'use client';
// Product management for the seller dashboard: add, hide / show, and edit stock per size and colour.
// Needs: POST /api/products, PATCH /api/products/:id (list comes from GET /api/products/mine, loaded by the page)
// AI helper: POST /api/ai/describe-photo
import { Fragment, useState } from 'react';
import { api } from '../lib/api';
import { bdt, commissionRate } from '../lib/data';
import PhotoPicker from './PhotoPicker';

const CATEGORIES = [['clothing', 'Clothing'], ['shoes', 'Shoes'], ['jewelry', 'Jewelry'], ['accessories', 'Accessories']];
const GENDERS = [['female', 'Women'], ['male', 'Men'], ['unisex', 'Unisex']];
const AGES = [['adult', 'Adult'], ['child', 'Child'], ['elderly', 'Elderly']];
const OCCASIONS = ['wedding', 'eid', 'party', 'formal', 'casual'];
const QUICK = {
  'S – XL': ['S', 'M', 'L', 'XL'],
  'Shoes 38 – 41': ['38', '39', '40', '41'],
  'Free size': ['Free'],
};
const totalStock = (p) => (p.variants || []).reduce((t, v) => t + (v.stock > 0 ? v.stock : 0), 0);
const csv = (s) => s.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);

// Rows of size / colour / stock. Used by the add form and by "Edit stock".
function VariantsEditor({ rows, setRows }) {
  const upd = (i, k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <div>
      <div className="opts" style={{ marginBottom: 8 }}>
        {Object.entries(QUICK).map(([label, sizes]) => (
          <button type="button" key={label} onClick={() => setRows(sizes.map((s) => ({ size: s, color: '', stock: '' })))}>{label}</button>
        ))}
      </div>
      {rows.map((r, i) => (
        <div className="f2" style={{ gridTemplateColumns: '1fr 1fr 1fr auto', marginBottom: 8 }} key={i}>
          <input placeholder="Size (M, 40, Free)" value={r.size} onChange={(e) => upd(i, 'size', e.target.value)} />
          <input placeholder="Colour (optional)" value={r.color} onChange={(e) => upd(i, 'color', e.target.value)} />
          <input type="number" min="0" placeholder="Stock" value={r.stock} onChange={(e) => upd(i, 'stock', e.target.value)} />
          <button type="button" className="btn alt sm2" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remove row">✕</button>
        </div>
      ))}
      <button type="button" className="btn alt sm2" onClick={() => setRows([...rows, { size: '', color: '', stock: '' }])}>+ Add size / colour</button>
    </div>
  );
}

// Turns the editor rows into what the API wants, or returns an error text.
function cleanVariants(rows) {
  if (!rows.length) return { error: 'Add at least one size with stock.' };
  const out = [], seen = new Set();
  for (const r of rows) {
    const size = r.size.trim(), color = r.color.trim().toLowerCase(), stock = r.stock === '' ? NaN : Number(r.stock);
    if (!size) return { error: 'Every row needs a size.' };
    if (!Number.isInteger(stock) || stock < 0) return { error: 'Stock must be a whole number, 0 or more.' };
    const key = size.toLowerCase() + '|' + color;
    if (seen.has(key)) return { error: `"${size}${color ? ' ' + color : ''}" is listed twice.` };
    seen.add(key); out.push({ size, color, stock });
  }
  return { value: out };
}

const EMPTY = { name: '', category: 'clothing', custom_category: '', gender: 'female', age_group: 'adult', price: '', discount_price: '', colors: '', occasions: [], images: [], description: '' };

export default function SellerProducts({ products, setProducts, shop }) {
  const [f, setF] = useState(EMPTY), [rows, setRows] = useState([{ size: '', color: '', stock: '' }]);
  const [err, setErr] = useState(''), [ok, setOk] = useState(''), [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false), [aiMsg, setAiMsg] = useState('');
  const [editId, setEditId] = useState(null), [editRows, setEditRows] = useState([]), [editImages, setEditImages] = useState([]), [rowErr, setRowErr] = useState(''), [rowBusy, setRowBusy] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggleOcc = (o) => setF({ ...f, occasions: f.occasions.includes(o) ? f.occasions.filter((x) => x !== o) : [...f.occasions, o] });

  // Asks the AI to look at the first photo and fill the form. Seller still reviews everything.
  const suggest = async () => {
    setErr(''); setOk(''); setAiMsg('');
    if (!f.images.length) return setErr('Add a photo first, then use the AI helper.');
    setAiBusy(true);
    try {
      const { data } = await api('/ai/describe-photo', { method: 'POST', body: { image_url: f.images[0] } });
      setF((x) => ({
        ...x,
        name: x.name || data.name || '',
        category: data.category || x.category,
        custom_category: x.custom_category || data.custom_category || '',
        gender: data.gender || x.gender,
        age_group: data.age_group || x.age_group,
        colors: x.colors || (data.colors || []).join(', '),
        occasions: x.occasions.length ? x.occasions : (data.occasions || []),
        description: x.description || data.description || '',
      }));
      setAiMsg('AI filled in the form. Please check every field, then add price and stock.');
    } catch (e2) { setErr(e2.message); }
    setAiBusy(false);
  };

  const rejected = shop.verification_status === 'rejected';
  const priceNow = f.discount_price ? +f.discount_price : +f.price;
  const aiOff = aiBusy || !f.images.length;

  const add = async (e) => {
    e.preventDefault(); setErr(''); setOk('');
    const price = Number(f.price), disc = f.discount_price === '' ? null : Number(f.discount_price);
    if (!f.name.trim()) return setErr('Product name is required.');
    if (!Number.isInteger(price) || price < 1) return setErr('Price must be a whole number of BDT.');
    if (disc !== null && (!Number.isInteger(disc) || disc < 1 || disc >= price)) return setErr('Discount price must be a whole number lower than the price.');
    const v = cleanVariants(rows); if (v.error) return setErr(v.error);

    const body = {
      name: f.name.trim(), category: f.category, gender: f.gender, age_group: f.age_group, price, variants: v.value,
      colors: csv(f.colors), occasion_tags: f.occasions,
    };
    if (f.custom_category.trim()) body.custom_category = f.custom_category.trim();
    if (disc !== null) body.discount_price = disc;
    if (f.description.trim()) body.description = f.description.trim();
    if (f.images.length) body.image_urls = f.images;
    setBusy(true);
    try {
      const res = await api('/products', { method: 'POST', body });
      setProducts([res.data, ...products]);
      setF(EMPTY); setRows([{ size: '', color: '', stock: '' }]); setAiMsg('');
      setOk('Product added.');
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  };

  const patch = async (p, body) => {
    setRowErr(''); setRowBusy(p.id);
    try {
      const res = await api(`/products/${p.id}`, { method: 'PATCH', body });
      setProducts(products.map((x) => (x.id === p.id ? { ...x, ...res.data } : x)));
      return true;
    } catch (e) { setRowErr(e.message); return false; }
    finally { setRowBusy(''); }
  };
  const openEdit = (p) => {
    if (editId === p.id) return setEditId(null);
    setRowErr(''); setEditId(p.id);
    setEditImages(p.image_urls || []);
    setEditRows((p.variants || []).map((v) => ({ size: v.size, color: v.color || '', stock: String(v.stock) })));
  };
  const saveEdit = async (p) => {
    const v = cleanVariants(editRows); if (v.error) return setRowErr(v.error);
    if (await patch(p, { variants: v.value, image_urls: editImages })) setEditId(null);
  };

  return (
    <div className="two">
      <div>
        {rowErr && <p className="err">{rowErr}</p>}
        {!products.length && <div className="box">No products yet. Add your first product with the form.</div>}
        {products.length > 0 && (
          <div className="tbl-w"><table className="tbl">
            <thead><tr><th>Product</th><th>Price</th><th>Stock</th><th /></tr></thead>
            <tbody>{products.map((p) => (
              <Fragment key={p.id}>
                <tr>
                  <td>{p.image_urls?.[0] && <img src={p.image_urls[0]} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8, float: 'left', marginRight: 10 }} />}{p.name} {p.status === 'hidden' && <span className="badge pend">Hidden</span>}<br /><span className="sm">{p.custom_category || p.category}</span></td>
                  <td>{bdt(p.price_now ?? p.price)}{p.discount_price != null && <><br /><span className="sm" style={{ textDecoration: 'line-through' }}>{bdt(p.price)}</span></>}</td>
                  <td>{totalStock(p) === 0 ? <span className="badge bad">Out of stock</span> : totalStock(p)}</td>
                  <td>
                    <button className="btn alt sm2" onClick={() => openEdit(p)}>{editId === p.id ? 'Close' : 'Edit stock & photos'}</button>{' '}
                    <button className="btn alt sm2" disabled={rowBusy === p.id || rejected} onClick={() => patch(p, { status: p.status === 'hidden' ? 'active' : 'hidden' })}>{p.status === 'hidden' ? 'Show' : 'Hide'}</button>
                  </td>
                </tr>
                {editId === p.id && (
                  <tr><td colSpan={4}>
                    <VariantsEditor rows={editRows} setRows={setEditRows} />
                    <div style={{ marginTop: 12 }}><PhotoPicker value={editImages} onChange={setEditImages} /></div>
                    <p style={{ marginTop: 10 }}><button className="btn sm2" disabled={rowBusy === p.id} onClick={() => saveEdit(p)}>Save changes</button></p>
                  </td></tr>
                )}
              </Fragment>
            ))}</tbody>
          </table></div>
        )}
      </div>

      <form className="box form wide" onSubmit={add}>
        <h3>Add product</h3>
        {rejected && <p className="err">Your shop was rejected. Fix it in Shop profile first.</p>}

        {/* ✨ AI quick start: photo first, then one big button */}
        <div style={{
          border: '2px solid #7c3aed', borderRadius: 14, padding: 14, color: '#1f1235',
          background: 'linear-gradient(135deg, #f5f3ff, #fdf2f8)',
          boxShadow: '0 4px 16px rgba(124, 58, 237, 0.18)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <strong style={{ fontSize: 16 }}>✨ Quick start with AI</strong>
            <span style={{ background: '#7c3aed', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>NEW</span>
          </div>
          <p className="sm" style={{ margin: '0 0 10px', color: '#4b3b6b' }}>
            Step 1: add a photo (the first one is the main photo). Step 2: tap the button and AI fills in the name, type, colours, occasions and description.
          </p>

          <PhotoPicker value={f.images} onChange={(images) => setF((x) => ({ ...x, images }))} />

          <button
            type="button"
            onClick={suggest}
            disabled={aiOff}
            style={{
              width: '100%', marginTop: 12, padding: '14px 16px', fontSize: 16, fontWeight: 700,
              color: '#fff', border: 'none', borderRadius: 12,
              background: 'linear-gradient(135deg, #7c3aed, #db2777)',
              cursor: aiOff ? 'not-allowed' : 'pointer',
              opacity: aiOff ? 0.55 : 1,
            }}
          >
            {aiBusy ? '✨ AI is looking at your photo…' : '✨ Fill the form with AI'}
          </button>

          {!f.images.length && <p className="sm" style={{ margin: '8px 0 0', color: '#4b3b6b' }}>Add a photo above to turn this button on.</p>}
          {aiMsg && <p className="sm" style={{ margin: '8px 0 0', color: '#15803d', fontWeight: 600 }}>✓ {aiMsg}</p>}
        </div>

        <input required placeholder="Product name" value={f.name} onChange={set('name')} />
        <div className="f2">
          <select value={f.category} onChange={set('category')}>{CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <input placeholder="Type (e.g. sari, kurti, heels)" value={f.custom_category} onChange={set('custom_category')} />
        </div>
        <div className="f2">
          <select value={f.gender} onChange={set('gender')}>{GENDERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <select value={f.age_group} onChange={set('age_group')}>{AGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </div>
        <div className="f2">
          <input type="number" min="1" placeholder="Price BDT" value={f.price} onChange={set('price')} />
          <input type="number" min="1" placeholder="Discount price (optional)" value={f.discount_price} onChange={set('discount_price')} />
        </div>
        {priceNow > 0 && <p className="sm">Commission {commissionRate(priceNow)}% · you receive {bdt(Math.round(priceNow * (1 - commissionRate(priceNow) / 100)))}</p>}
        <input placeholder="Colours, separated by commas (e.g. maroon, gold)" value={f.colors} onChange={set('colors')} />
        <div><span className="sm">Occasions</span>
          <div className="opts" style={{ marginTop: 6 }}>{OCCASIONS.map((o) => <button type="button" key={o} className={f.occasions.includes(o) ? 'on' : ''} onClick={() => toggleOcc(o)}>{o}</button>)}</div>
        </div>
        <div><span className="sm">Sizes and stock</span><div style={{ marginTop: 6 }}><VariantsEditor rows={rows} setRows={setRows} /></div></div>
        <textarea placeholder="Description (optional)" value={f.description} onChange={set('description')} />
        {err && <p className="err">{err}</p>}
        {ok && <p className="sm" style={{ color: 'var(--ok)' }}>{ok}</p>}
        <button className="btn" disabled={busy || rejected}>{busy ? 'Saving…' : 'Publish product'}</button>
      </form>
    </div>
  );
}