const P = [
  ['🛍️', 'Marketplace', 'Sellers open a shop, list products with sizes, colors and prices, and organize custom categories like Kurti, Sari or Three-piece.'],
  ['✨', 'AI Stylist', "Tell it the occasion, budget and who it's for. It assembles a complete look from live, in-stock products only."],
  ['📈', 'Seller Intelligence', 'Trends, best performers and unmet demand in plain Bangla or English – so you know what to restock.'],
  ['🛡️', 'Trust Layer', 'Admin-verified complaints create a visible badge for sellers and customers. No automatic or one-sided badges.'],
];
export default function Pillars() {
  return (
    <section id="pillars" className="sec"><div className="wrap">
      <h2>One platform, four pillars</h2>
      <div className="cards4">
        {P.map(([i, h, p]) => <article key={h}><div className="ic">{i}</div><h3>{h}</h3><p>{p}</p></article>)}
      </div>
    </div></section>
  );
}
