'use client';
import { PRODUCTS, SHOPS } from '../lib/data';

// Real counts from the live catalog (the Store loads it before anything renders).
const BENEFITS = [
  ['🎯', 'A stylist that respects your budget', 'Tell it your budget and occasion. It only suggests real, in-stock items from verified sellers.'],
  ['🔒', 'Escrow on every order', 'Your payment is held safely until you confirm delivery or 48 hours pass. Sellers are paid on delivery.'],
  ['📦', 'One place for small sellers', 'Orders, stock, earnings and analytics in one dashboard, instead of scattered chats.'],
];

export default function Testimonials() {
  const stats = [[PRODUCTS.length, 'Products listed'], [SHOPS.length, 'Verified shops'], ['48h', 'Escrow protection']];
  return (
    <section className="sec tint"><div className="wrap">
      <ul className="stats band">{stats.map(([b, t]) => <li key={t}><b>{b}</b>{t}</li>)}</ul>
      <h2 style={{ marginTop: 44 }}>Why shoppers and sellers use Dokan AI</h2>
      <div className="cards4 three">{BENEFITS.map(([icon, title, text]) => (
        <article key={title}><div className="ic">{icon}</div><h3>{title}</h3><p>{text}</p></article>
      ))}</div>
    </div></section>
  );
}