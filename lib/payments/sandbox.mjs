// The sandbox payment gateway. No real money moves (PAY-1, PAY-6).
// Order logic only calls charge(); a live provider (SSLCommerz, bKash API) can replace this file later (PAY-7).
export const GATEWAYS = ['bkash', 'nagad', 'card'];
export const OUTCOMES = ['success', 'failure', 'pending'];

// Returns { status: 'success' | 'failed' | 'pending', reference }.
export function charge({ amount, gateway = 'bkash', outcome = 'success' }) {
  if (!Number.isInteger(amount) || amount < 0) throw new Error('bad amount');
  if (!GATEWAYS.includes(gateway)) throw new Error('bad gateway');
  if (!OUTCOMES.includes(outcome)) throw new Error('bad outcome');
  const status = outcome === 'failure' ? 'failed' : outcome;
  return { status, reference: 'SBX-' + gateway.toUpperCase() + '-' + Math.random().toString(36).slice(2, 10).toUpperCase() };
}
