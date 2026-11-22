const Q = [
  ['Tania S.', 'Shopper · Chattogram', 'I gave it my budget and got a full wedding look in a minute. No more scrolling through chats.'],
  ['Nusrat A.', 'Boutique owner · Comilla', 'My orders, stock and payouts are finally in one place. The restock tips are a big help.'],
  ['Rafi H.', 'Menswear seller · Dhaka', 'Escrow means customers trust me from the first order, and I get paid on delivery.'],
];
const stats = [['2,000+', 'Products listed'], ['500+', 'Small sellers'], ['48h', 'Escrow protection'], ['4.8★', 'Average shop rating']];
export default function Testimonials() {
  return (
    <section className="sec tint"><div className="wrap">
      <ul className="stats band">{stats.map(([b, t]) => <li key={t}><b>{b}</b>{t}</li>)}</ul>
      <h2 style={{ marginTop: 44 }}>Loved by shoppers and sellers</h2>
      <div className="cards4 three">{Q.map(([n, r, t]) => (
        <article key={n}><div className="stars">★★★★★</div><p>“{t}”</p><div className="who"><i>{n[0]}</i><div><b>{n}</b><small>{r}</small></div></div></article>))}</div>
    </div></section>
  );
}