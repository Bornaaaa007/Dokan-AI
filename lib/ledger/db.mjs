// Database access for the ledger. It reuses the orders database (users, shops) and adds one read of paid orders.
import { createOrdersDb } from '../orders/db.mjs';
import { LEDGER_DB_STATUSES, MAX_ROWS } from './rules.mjs';

const COLS = 'id,customer_id,shop_id,item_total,delivery_charge,commission_rate,commission_amount,payment_method,payment_status,status,placed_at,paid_at,delivered_at,released_at,refunded_at';
const CHUNK = 1000;   // Supabase returns at most 1000 rows per request

export function createLedgerDb(sb) {
  return {
    ...createOrdersDb(sb),
    // Reads every matching paid order in chunks. Returns up to MAX_ROWS + 1 rows so the caller can tell "too many".
    async listLedgerOrders({ shopId, status, startIso, endIso }) {
      const rows = [];
      for (let from = 0; rows.length <= MAX_ROWS; from += CHUNK) {
        let q = sb.from('orders').select(COLS).in('payment_status', status ? (status === 'held' ? ['held', 'paid'] : [status]) : LEDGER_DB_STATUSES);
        if (shopId) q = q.eq('shop_id', shopId);
        if (startIso) q = q.gte('placed_at', startIso);
        if (endIso) q = q.lt('placed_at', endIso);
        const { data, error } = await q.order('placed_at', { ascending: false }).order('id').range(from, from + CHUNK - 1);
        if (error) throw new Error('list ledger: ' + error.message);
        rows.push(...(data ?? []));
        if (!data || data.length < CHUNK) break;
      }
      return rows.slice(0, MAX_ROWS + 1);
    },
  };
}
