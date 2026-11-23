'use client';
import { useLang } from './LangProvider';

const items = [['#8a1538', 'Maroon Katan Sari', '2,600'], ['#c9a227', 'Gold Jhumka Set', '1,150'], ['#2b2b3a', 'Block Heels', '900']];

export default function Hero() {
  const { t } = useLang();
  return (
    <section className="hero"><div className="wrap grid2">
      <div>
        <span className="chip">Made for Bangladesh · বাংলা &amp; English</span>
        <h1>{t.h1}</h1>
        <p className="lead">{t.lead}</p>
        <div className="row g" style={{ justifyContent: 'flex-start' }}>
          <a className="btn" href="#stylist">{t.try}</a>
          <a className="btn alt" href="#shop-the-look">{t.look}</a>
          <a className="btn alt" href="#sellers">{t.sell}</a>
        </div>
        <ul className="stats">
          <li><b>0 BDT</b>to open a shop</li><li><b>2–5%</b>commission only on sales</li><li><b>48h</b>escrow protection</li>
        </ul>
      </div>
      <div className="phone" aria-hidden="true">
        <div className="bub u">Tania · wedding guest · 5,000 BDT</div>
        <div className="bub a">Here&apos;s a full look: sari, shoes &amp; jewelry — <b>4,650 BDT</b>, 350 left ✨</div>
        {items.map(([c, n, p]) => <div className="mini" key={n}><i style={{ background: c }} /><span>{n}<em>{p}</em></span></div>)}
        <div className="bub a sm">Swap an item or add all to cart →</div>
      </div>
    </div></section>
  );
}
