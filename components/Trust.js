const steps = [['File', 'Report from the order page with evidence.'], ['Respond', 'The other party has 48 hours.'], ['Review', 'Admin checks both sides and records written reasons.'], ['Decide', 'Upheld, rejected or partial – with one appeal in 7 days.'], ['Badge', 'Shown as “Verified complaints”, expires after 3–6 months.']];
const cards = [['Escrow', 'Funds release on delivery confirmation or after 48 hours with no complaint.'], ['Verified sellers', 'NID, social page and payout account checked by staff.'], ['Fair by design', 'Bad reviews never create badges. Appeals are reviewed by a different admin.'], ['Private', 'Badges show only the label and level – never evidence or names.']];
export default function Trust() {
  return (
    <section id="trust" className="sec tint"><div className="wrap">
      <h2>Trust you can see</h2>
      <p className="sub">Payments sit in escrow, and every fraud badge comes from a verified complaint reviewed by a human admin.</p>
      <ol className="steps">{steps.map(([b, t]) => <li key={b}><b>{b}</b>{t}</li>)}</ol>
      <div className="cards4 sm">{cards.map(([h, p]) => <article key={h}><h3>{h}</h3><p>{p}</p></article>)}</div>
    </div></section>
  );
}
