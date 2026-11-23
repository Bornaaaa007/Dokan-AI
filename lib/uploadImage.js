// Uploads one product photo to Supabase Storage (bucket "product-images") and returns its public https link.
// The photo is shrunk in the browser first (max 1200px, JPEG) so uploads are fast and small.
// Needs the storage SQL (scripts/storage.sql) to have been run once.
import { supabase } from './supabaseClient';

const BUCKET = 'product-images';
const MAX_INPUT = 10 * 1024 * 1024;   // photo straight from a phone camera
const MAX_OUTPUT = 2 * 1024 * 1024;   // what we actually store (the bucket enforces the same limit)
const MAX_SIDE = 1200;

async function shrink(file) {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * scale)); c.height = Math.max(1, Math.round(bmp.height * scale));
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
    if (blob) return blob;
  } catch { /* browser cannot resize: upload the original */ }
  return file;
}

export async function uploadProductPhoto(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Use a JPG, PNG or WebP photo.');
  if (file.size > MAX_INPUT) throw new Error('That photo is too big (max 10 MB).');
  const blob = await shrink(file);
  if (blob.size > MAX_OUTPUT) throw new Error('That photo is still over 2 MB. Please use a smaller one.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in again.');
  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`;   // each seller writes only inside their own folder
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '31536000' });
  if (error) throw new Error(/row-level|policy|not found/i.test(error.message) ? 'Photo upload is not set up yet. Run scripts/storage.sql in Supabase.' : error.message);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
