'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { downloadCsv } from '../lib/downloadCsv';
import { bdt } from '../lib/data';

// One ledger table for both roles. base = '/seller/ledger' (seller) or '/admin/ledger' (admin).
export default function LedgerPanel({ base, title = 'Payment ledger' }) {
  const [status, setStatus] = useState(''), [from, setFrom] = useState(''), [to, setTo] = useState('');
  const [rows, setRows] = useState(null), [sum, setSum] = useState(null), [err, setErr] = useState(''), [dl, setDl] = useState(false);

  const query = (extra = '') => {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    return base + '?' + p.toString() + extra;
  };

  const load = useCallback(async () => {
    setErr('');
    try {
      const r = await api(query('&limit=100'));
      setRows(r.data.entries); setSum(r.data.summary);
    } catch (e) { setErr(e.message); setRows([]); }
  }, [status, from, to, base]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const csv = async () => {
    setDl(true); setErr('');
    try { await downloadCsv(query('&format=csv'), 'ledger.csv'); } catch (e) { setErr(e.message); }
    setDl(false);
  };

  return (
    <div>
      <div className="banner" style={{ borderRadius: 10, marginBottom: 14 }}>Sandbox: no real money moves.</div>
      <h3>{title}</h3>
      {sum && <div className="kpis">
        <div><b>{sum.orders}</b><span>Paid orders</span></div>
        <div><b>{bdt(sum.item_total)}</b><span>Item sales</span></div>
        <div><b>{bdt(sum.in_escrow)}</b><span>In escrow</span></div>
        <div><b>{bdt(sum.commission_booked)}</b><span>Commission</span></div>
        <div><b>{bdt(sum.paid_to_sellers)}</b><span>Paid to sellers</span></div>
        <div><b>{bdt(sum.refunded)}</b><span>Refunded</span></div>
      </div>}
      <div className="toolbar" style={{ margin: '14px 0' }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option><option value="held">Held</option><option value="released">Released</option><option value="refunded">Refunded</option>
        </select>
        <label className="sm">From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="sm">To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <button className="btn alt sm2" onClick={csv} disabled={dl}>{dl ? 'Preparing…' : 'Download CSV'}</button>
      </div>
      {err && <p className="err">{err}</p>}
      {rows === null ? <div className="box">Loading ledger…</div> : !rows.length ? <div className="box">No paid orders match.</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Order</th>{base.includes('admin') && <th>Shop</th>}<th>Placed</th><th>Items</th><th>Commission</th><th>Seller payout</th><th>Escrow</th></tr></thead>
            <tbody>{rows.map((e) => (
              <tr key={e.order_id}>
                <td>{String(e.order_id).slice(0, 8).toUpperCase()}</td>
                {base.includes('admin') && <td>{e.shop_name}</td>}
                <td>{new Date(e.placed_at).toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka' })}</td>
                <td>{bdt(e.item_total)}</td>
                <td>{bdt(e.commission_amount)} <span className="sm">({e.commission_rate}%)</span></td>
                <td>{bdt(e.seller_payout)}</td>
                <td><span className={`badge ${e.escrow_status === 'released' ? '' : e.escrow_status === 'refunded' ? 'bad' : 'pend'}`}>{e.escrow_status}</span></td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}