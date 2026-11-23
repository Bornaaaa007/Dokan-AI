// Pure rules for product reviews. No database, no network.
// A product review needs a DELIVERED, not refunded order of the customer's own that contains the product.
import { UUID } from '../api/http.mjs';
export { displayName, summarize } from '../reviews/rules.mjs';

export const LIMITS = { bodyMin: 10, bodyMax: 500, listMax: 50, perDay: 10 };
export const STATUSES = ['visible', 'hidden'];
export const ADMIN_SETTABLE = STATUSES;

export function validateProductReview(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return { ok: false, message: 'Send a JSON object with order_id, rating and text.' };
  if (typeof body.order_id !== 'string' || !UUID.test(body.order_id)) return { ok: false, message: 'order_id must be the id of your delivered order.' };
  if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) return { ok: false, message: 'rating must be a whole number from 1 to 5.' };
  if (typeof body.body !== 'string') return { ok: false, message: 'body must be text.' };
  const text = body.body.trim();
  if (text.length < LIMITS.bodyMin || text.length > LIMITS.bodyMax) return { ok: false, message: `body must be ${LIMITS.bodyMin} to ${LIMITS.bodyMax} characters.` };
  return { ok: true, value: { order_id: body.order_id.toLowerCase(), rating: body.rating, body: text } };
}

export const orderHasProduct = (order, productId) =>
  Array.isArray(order?.items) && order.items.some((i) => String(i?.product_id).toLowerCase() === String(productId).toLowerCase());

// Returns null when the customer may review, otherwise { status, code, message }.
export function checkEligible({ order, userId, productId }) {
  if (!order || order.customer_id !== userId || !orderHasProduct(order, productId))
    return { status: 403, code: 'not_eligible', message: 'You can only review products from your own delivered orders.' };
  if (order.status !== 'delivered')
    return { status: 409, code: 'not_delivered', message: 'You can review this product after the order is delivered.' };
  // A refunded order (full refund, or an upheld complaint) is no longer a completed purchase.
  if (order.payment_status === 'refunded')
    return { status: 409, code: 'order_refunded', message: 'This order was refunded, so it can no longer be reviewed.' };
  return null;
}
