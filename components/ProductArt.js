import { COLORS } from '../lib/data';

const KIND = { Sari: 'dress', Kurti: 'dress', 'Three-piece': 'dress', Frock: 'dress', Dress: 'dress', Shirt: 'shirt', Panjabi: 'shirt', Fatua: 'shirt', Pants: 'pants', Skirt: 'skirt', Heels: 'heel', Sandals: 'shoe', 'Formal shoes': 'shoe', Earrings: 'ear', Necklace: 'neck', Watch: 'watch', Clutch: 'clutch' };

/** Uses p.img if you add a real photo URL to lib/data.js, otherwise draws an illustration. */
export default function ProductArt({ p }) {
  if (p.img) return <img className="pimg" src={p.img} alt={p.name} loading="lazy" />;
  const c = COLORS[p.color] || '#8a1538', k = KIND[p.cat] || 'dress', hl = { fill: '#fff', opacity: 0.2 };
  const shapes = {
    dress: <><path d="M82 28h36l8 40 26 108H48l26-108z" fill={c} /><path d="M82 28q18 22 36 0" fill="#fff" opacity=".35" /><path d="M70 98h60" stroke="#fff" strokeOpacity=".35" strokeWidth="4" /><path d="M84 68l-10 108H60z" {...hl} /></>,
    shirt: <><path d="M68 32l32 14 32-14 40 32-20 26-16-10v90H64V80L48 90 28 64z" fill={c} /><path d="M100 46l-14-8 14 24 14-24z" fill="#fff" opacity=".4" /><path d="M100 62v108" stroke="#fff" strokeOpacity=".3" strokeWidth="3" /><path d="M64 80v90h20z" {...hl} /></>,
    pants: <><path d="M66 30h68l10 148h-34l-10-84-10 84H56z" fill={c} /><path d="M66 30h68v14H66z" fill="#fff" opacity=".3" /><path d="M100 44v50" stroke="#fff" strokeOpacity=".3" strokeWidth="3" /></>,
    skirt: <><path d="M72 40h56l34 132H38z" fill={c} /><path d="M72 40h56v12H72z" fill="#fff" opacity=".3" /><path d="M90 52l-24 120M110 52l24 120" stroke="#fff" strokeOpacity=".25" strokeWidth="3" /></>,
    shoe: <><path d="M26 124c34 0 40-34 62-34l26 16c26 4 58 8 62 32v20H26z" fill={c} /><path d="M26 152h150v10H26z" fill="#222" opacity=".55" /><path d="M92 96l14 10M80 104l14 10" stroke="#fff" strokeOpacity=".5" strokeWidth="3" /></>,
    heel: <><path d="M40 70c10 0 14 10 20 22l60 24c26 4 44 16 44 32v10H70c-14 0-28-26-30-58z" fill={c} /><path d="M52 150l8 28h10l-4-28z" fill="#222" opacity=".7" /><path d="M70 150h104v10H70z" fill="#222" opacity=".4" /></>,
    ear: <>{[70, 130].map((x) => <g key={x}><path d={`M${x} 30v26`} stroke="#999" strokeWidth="3" /><circle cx={x} cy="74" r="18" fill={c} /><circle cx={x} cy="74" r="8" fill="#fff" opacity=".5" /><circle cx={x} cy="106" r="7" fill={c} /><circle cx={x} cy="124" r="5" fill={c} /></g>)}</>,
    neck: <><path d="M40 50c0 80 120 80 120 0" fill="none" stroke={c} strokeWidth="6" /><circle cx="100" cy="120" r="16" fill={c} /><circle cx="100" cy="120" r="7" fill="#fff" opacity=".55" />{[62, 80, 120, 138].map((x, i) => <circle key={x} cx={x} cy={[92, 108, 108, 92][i]} r="6" fill={c} />)}</>,
    watch: <><path d="M80 20h40l6 52H74zM74 128h52l-6 52H80z" fill="#444" /><circle cx="100" cy="100" r="42" fill={c} /><circle cx="100" cy="100" r="33" fill="#f4efe8" /><path d="M100 100V78M100 100l16 8" stroke="#222" strokeWidth="4" strokeLinecap="round" /></>,
    clutch: <><rect x="30" y="64" width="140" height="86" rx="16" fill={c} /><path d="M30 80q70 36 140 0v-4a12 12 0 0 0-12-12H42a12 12 0 0 0-12 12z" fill="#fff" opacity=".28" /><circle cx="100" cy="106" r="9" fill="#f2d98a" /></>,
  };
  return (
    <svg className="art" viewBox="0 0 200 200" role="img" aria-label={p.name} preserveAspectRatio="xMidYMid meet">
      <rect width="200" height="200" style={{ fill: `color-mix(in srgb, ${c} 14%, #fff)` }} />
      <ellipse cx="100" cy="186" rx="60" ry="6" fill="#000" opacity=".08" />
      {shapes[k]}
    </svg>
  );
}