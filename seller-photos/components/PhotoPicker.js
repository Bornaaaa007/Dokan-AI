'use client';
// Pick photos from the seller's phone or computer, upload them, and keep the list of public links.
// value = array of https links (first one is the main photo). onChange(newArray).
import { useRef, useState } from 'react';
import { uploadProductPhoto } from '../lib/uploadImage';

export default function PhotoPicker({ value, onChange, max = 5 }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');

  const pick = async (e) => {
    const files = [...(e.target.files || [])];
    if (input.current) input.current.value = '';
    if (!files.length) return;
    setErr('');
    const room = max - value.length;
    if (room <= 0) return setErr(`You can add up to ${max} photos.`);
    if (files.length > room) setErr(`Only the first ${room} photo(s) were added (max ${max}).`);
    setBusy(true);
    let next = [...value];
    for (const f of files.slice(0, room)) {
      try { next = [...next, await uploadProductPhoto(f)]; onChange(next); }
      catch (e2) { setErr(e2.message); break; }
    }
    setBusy(false);
  };
  const remove = (i) => onChange(value.filter((_, j) => j !== i));
  const makeMain = (i) => onChange([value[i], ...value.filter((_, j) => j !== i)]);

  return (
    <div>
      <div className="row g" style={{ flexWrap: 'wrap', gap: 10 }}>
        {value.map((u, i) => (
          <div key={u} style={{ position: 'relative', width: 84 }}>
            <img src={u} alt={`Photo ${i + 1}`} style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--line)', display: 'block' }} />
            <button type="button" aria-label="Remove photo" onClick={() => remove(i)} style={{ position: 'absolute', top: 2, right: 2, border: 0, borderRadius: 99, width: 22, height: 22, cursor: 'pointer' }}>✕</button>
            {i === 0 ? <span className="badge" style={{ position: 'absolute', left: 4, bottom: 4 }}>Main</span>
              : <button type="button" className="badge" onClick={() => makeMain(i)} style={{ position: 'absolute', left: 4, bottom: 4, border: 0, cursor: 'pointer' }}>Make main</button>}
          </div>
        ))}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple style={{ display: 'none' }} onChange={pick} />
      <button type="button" className="btn alt sm2" style={{ marginTop: value.length ? 10 : 0 }} disabled={busy || value.length >= max} onClick={() => input.current && input.current.click()}>
        {busy ? 'Uploading…' : value.length ? '+ Add more photos' : '+ Add photos'}
      </button>
      <span className="sm"> {value.length}/{max} · JPG, PNG or WebP</span>
      {err && <p className="err">{err}</p>}
    </div>
  );
}
