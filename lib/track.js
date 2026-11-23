import { api } from './api';

// Records a product view or add-to-cart for seller analytics. Never blocks the page.
export function track(type, product) {
  if (!product?.uuid) return; // sample data has no database id
  api('/events', { method: 'POST', body: { type, product_id: product.uuid } }).catch(() => {});
}