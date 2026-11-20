const R = [['Phase 1 · MVP', 'Shops, listings, browse, sandbox checkout, AI stylist, complaints'], ['Phase 2', 'Premium, analytics, reviews, vouchers, push'], ['Phase 3', 'Live payments, couriers, iOS app'], ['Phase 4', 'Wholesale, ads, loyalty, video']];
export default function Roadmap() {
  return (
    <section className="sec"><div className="wrap">
      <h2>Roadmap</h2>
      <div className="road">{R.map(([b, t]) => <div key={b}><b>{b}</b>{t}</div>)}</div>
    </div></section>
  );
}
