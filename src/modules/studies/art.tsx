import { memo, useId, type ReactNode } from 'react';

// Generated notebook covers. Everything is drawn from code, so they work offline, cost
// nothing to store and stay sharp at any size. Each is a 400 x 400 scene that reads well
// cropped to a tall book or a wide banner, so the interest stays around the middle.

/** Small repeatable random generator, so a cover looks the same every time. */
const rng = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

const hill = (y: number, amp: number, freq: number, phase: number) => {
  let d = `M0 400L0 ${y + Math.sin(phase) * amp}`;
  for (let x = 10; x <= 400; x += 10) d += `L${x} ${(y + Math.sin((x / 400) * Math.PI * 2 * freq + phase) * amp + Math.sin((x / 400) * Math.PI * 2 * freq * 2.3 + phase * 1.7) * amp * 0.3).toFixed(1)}`;
  return `${d}L400 400Z`;
};

const ridge = (y: number, jag: number, seed: number) => {
  const r = rng(seed);
  let d = `M0 400L0 ${y}`;
  for (let x = 0; x <= 420; x += 20 + r() * 30) d += `L${x.toFixed(0)} ${(y - r() * jag + jag / 2).toFixed(0)}`;
  return `${d}L400 400Z`;
};

const blob = (cx: number, cy: number, radius: number, seed: number) => {
  let d = '';
  for (let a = 0; a <= 64; a++) {
    const t = (a / 64) * Math.PI * 2;
    const k = radius * (1 + 0.16 * Math.sin(t * 3 + seed) + 0.09 * Math.sin(t * 5 + seed * 2) + 0.05 * Math.sin(t * 2 - seed));
    d += `${a ? 'L' : 'M'}${(cx + Math.cos(t) * k).toFixed(1)} ${(cy + Math.sin(t) * k).toFixed(1)}`;
  }
  return `${d}Z`;
};

type Draw = (uid: string) => ReactNode;

const Dusk: Draw = (u) => (
  <>
    <defs>
      <linearGradient id={`${u}s`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3b2670" /><stop offset=".45" stopColor="#c2487f" /><stop offset=".75" stopColor="#ff9a6b" /><stop offset="1" stopColor="#ffd08a" /></linearGradient>
    </defs>
    <rect width="400" height="400" fill={`url(#${u}s)`} />
    <circle cx="245" cy="225" r="52" fill="#ffe8b0" />
    <path d={hill(260, 22, 1.2, 0.6)} fill="#a83f76" />
    <path d={hill(295, 20, 1.5, 2.1)} fill="#742f6c" />
    <path d={hill(330, 18, 1.1, 4)} fill="#46245c" />
    <path d={hill(365, 12, 1.6, 1)} fill="#281845" />
  </>
);

const Ridge: Draw = (u) => (
  <>
    <defs>
      <linearGradient id={`${u}s`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0e3a5c" /><stop offset=".6" stopColor="#5fa8b8" /><stop offset="1" stopColor="#dcefe6" /></linearGradient>
    </defs>
    <rect width="400" height="400" fill={`url(#${u}s)`} />
    <circle cx="270" cy="168" r="28" fill="#f6f4e4" />
    <circle cx="281" cy="161" r="24" fill="#3f819a" opacity=".92" />
    <path d={ridge(215, 80, 11)} fill="#6d9fb3" />
    <path d={ridge(255, 90, 29)} fill="#3f7690" />
    <path d={ridge(300, 80, 53)} fill="#23506e" />
    <path d={ridge(350, 60, 97)} fill="#10304b" />
  </>
);

const Tide: Draw = () => (
  <>
    <rect width="400" height="400" fill="#0b2a43" />
    {['#0f4a63', '#14687a', '#1d8a8c', '#3bab9b', '#7cc9ac', '#c2e6c6', '#f3f5dc'].map((c, i) => (
      <path key={c} d={hill(70 + i * 48, 20, 1.5, i * 1.15)} fill={c} />
    ))}
  </>
);

const Contour: Draw = () => (
  <>
    <rect width="400" height="400" fill="#17372d" />
    <g fill="none" stroke="#a8e0b4" strokeWidth="1.4">
      {Array.from({ length: 13 }, (_, i) => <path key={i} d={blob(205, 205, 22 + i * 21, 1.3)} opacity={1 - i * 0.055} />)}
    </g>
    <circle cx="205" cy="205" r="6" fill="#e9f77a" />
  </>
);

const Night: Draw = (u) => {
  const r = rng(77);
  const stars = Array.from({ length: 90 }, () => ({ x: r() * 400, y: r() * 400, s: 0.4 + r() * 1.3, o: 0.35 + r() * 0.65 }));
  const line: [number, number][] = [[90, 150], [150, 105], [205, 165], [270, 130], [320, 195], [245, 245], [205, 165]];
  return (
    <>
      <defs>
        <radialGradient id={`${u}s`} cx=".6" cy=".35" r=".9"><stop offset="0" stopColor="#3a3a96" /><stop offset=".55" stopColor="#1b1b58" /><stop offset="1" stopColor="#090a26" /></radialGradient>
      </defs>
      <rect width="400" height="400" fill={`url(#${u}s)`} />
      {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#fff" opacity={s.o} />)}
      <polyline points={line.map((p) => p.join(',')).join(' ')} fill="none" stroke="#c9ccff" strokeWidth="1" opacity=".75" />
      {line.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.6" fill="#fff4c9" />)}
    </>
  );
};

const Bauhaus: Draw = () => {
  const c = { red: '#d9432f', blue: '#1f4e9c', yellow: '#efb321', ink: '#1c1c1a', cream: '#f3ead7', teal: '#2d8f85' };
  const size = 100;
  const q = (x: number, y: number, corner: number, fill: string) => {
    const pts = [[x, y], [x + size, y], [x + size, y + size], [x, y + size]];
    const [ax, ay] = pts[corner];
    const [bx, by] = pts[(corner + 1) % 4];
    const [dx, dy] = pts[(corner + 3) % 4];
    return <path d={`M${ax} ${ay}L${bx} ${by}A${size} ${size} 0 0 1 ${dx} ${dy}Z`} fill={fill} />;
  };
  const tiles: [number, string, string][] = [
    [0, c.blue, c.cream], [1, c.yellow, c.ink], [3, c.red, c.cream], [2, c.teal, c.yellow],
    [2, c.ink, c.red], [0, c.cream, c.blue], [1, c.red, c.yellow], [3, c.yellow, c.blue],
    [3, c.teal, c.cream], [2, c.yellow, c.ink], [0, c.blue, c.red], [1, c.cream, c.teal],
    [1, c.red, c.blue], [3, c.ink, c.yellow], [2, c.cream, c.red], [0, c.yellow, c.ink],
  ];
  return (
    <>
      {tiles.map(([corner, bg, fg], i) => {
        const x = (i % 4) * size;
        const y = Math.floor(i / 4) * size;
        return (
          <g key={i}>
            <rect x={x} y={y} width={size} height={size} fill={bg} />
            {q(x, y, corner, fg)}
          </g>
        );
      })}
    </>
  );
};

const Fern: Draw = () => {
  const frond = (x: number, base: number, lean: number, scale: number, fill: string, key: number) => {
    const leaves = [];
    for (let i = 1; i <= 11; i++) {
      const t = i / 12;
      const px = x + lean * t * t * 120;
      const py = base - t * 300 * scale;
      const len = 62 * scale * (1 - t * 0.72);
      for (const side of [-1, 1]) {
        leaves.push(<ellipse key={`${i}${side}`} cx={px + side * len * 0.55} cy={py - 6} rx={len * 0.58} ry={len * 0.17} transform={`rotate(${side * -28 + lean * 12} ${px} ${py})`} fill={fill} />);
      }
    }
    return (
      <g key={key}>
        <path d={`M${x} ${base}Q${x + lean * 30} ${base - 150 * scale} ${x + lean * 120} ${base - 300 * scale}`} stroke={fill} strokeWidth="3" fill="none" />
        {leaves}
      </g>
    );
  };
  return (
    <>
      <rect width="400" height="400" fill="#e7ecd6" />
      <circle cx="205" cy="165" r="118" fill="#f4dfb6" />
      {frond(90, 420, -0.5, 1, '#9db98a', 1)}
      {frond(330, 420, 0.5, 1.02, '#88a878', 2)}
      {frond(150, 420, 0.25, 1.15, '#57805e', 3)}
      {frond(255, 420, -0.3, 1.2, '#2f5c49', 4)}
    </>
  );
};

const Sunburst: Draw = () => {
  const rays = 18;
  return (
    <>
      <rect width="400" height="400" fill="#f4a93a" />
      {Array.from({ length: rays }, (_, i) => {
        const a = (i / rays) * Math.PI * 2;
        const b = ((i + 0.5) / rays) * Math.PI * 2;
        return <path key={i} d={`M200 215L${200 + Math.cos(a) * 500} ${215 + Math.sin(a) * 500}L${200 + Math.cos(b) * 500} ${215 + Math.sin(b) * 500}Z`} fill="#ef7f2d" />;
      })}
      <circle cx="200" cy="215" r="96" fill="#fff0c2" />
      <circle cx="200" cy="215" r="70" fill="#e4432f" />
      <circle cx="200" cy="215" r="42" fill="#7f1d3f" />
    </>
  );
};

const Graph: Draw = () => {
  const curve = (fn: (x: number) => number) => Array.from({ length: 81 }, (_, i) => `${i ? 'L' : 'M'}${i * 5} ${fn(i * 5).toFixed(1)}`).join('');
  return (
    <>
      <rect width="400" height="400" fill="#f6f4e9" />
      <g stroke="#a9c6dd" strokeWidth=".7">
        {Array.from({ length: 21 }, (_, i) => (
          <g key={i}>
            <line x1={i * 20} x2={i * 20} y2="400" strokeWidth={i % 5 ? 0.7 : 1.5} />
            <line y1={i * 20} y2={i * 20} x2="400" strokeWidth={i % 5 ? 0.7 : 1.5} />
          </g>
        ))}
      </g>
      <path d="M0 200H400M200 0V400" stroke="#26415c" strokeWidth="2" />
      <path d={curve((x) => 200 + Math.sin((x - 200) / 42) * 92)} fill="none" stroke="#d9432f" strokeWidth="4" strokeLinecap="round" />
      <path d={curve((x) => 200 + Math.cos((x - 200) / 42) * 92)} fill="none" stroke="#1f6fbd" strokeWidth="4" strokeLinecap="round" />
      <path d={curve((x) => 330 - (x - 200) ** 2 / 95)} fill="none" stroke="#e0a11b" strokeWidth="4" strokeLinecap="round" />
    </>
  );
};

const Orbit: Draw = (u) => (
  <>
    <defs>
      <radialGradient id={`${u}s`}><stop offset="0" stopColor="#7b3fd1" /><stop offset=".6" stopColor="#3b1b86" /><stop offset="1" stopColor="#170a3f" /></radialGradient>
    </defs>
    <rect width="400" height="400" fill={`url(#${u}s)`} />
    <g fill="none" stroke="#d6c6ff" strokeWidth="2.2">
      {[0, 60, 120].map((r) => <ellipse key={r} cx="200" cy="205" rx="158" ry="58" transform={`rotate(${r} 200 205)`} />)}
    </g>
    <circle cx="200" cy="205" r="24" fill="#ffd35c" />
    <circle cx="192" cy="197" r="8" fill="#fff0bd" />
    <circle cx="358" cy="205" r="9" fill="#6df0d0" />
    <circle cx="121" cy="68" r="9" fill="#ff8fb8" />
    <circle cx="121" cy="342" r="9" fill="#8fd0ff" />
  </>
);

const Ribbon: Draw = () => (
  <>
    <rect width="400" height="400" fill="#fbf1e3" />
    <g fill="none" strokeWidth="46">
      {['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51', '#b5446e'].map((c, i) => (
        <path key={c} stroke={c} d={`M-40 ${70 + i * 50}C110 ${-40 + i * 50} 210 ${260 + i * 50} 440 ${70 + i * 50}`} />
      ))}
    </g>
  </>
);

const Marble: Draw = (u) => (
  <>
    <defs>
      <filter id={`${u}m`} x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency=".008 .012" numOctaves="3" seed="8" />
        <feDisplacementMap in="SourceGraphic" scale="170" />
      </filter>
    </defs>
    <g filter={`url(#${u}m)`}>
      {['#1c2541', '#f2e9dc', '#b3323e', '#f2e9dc', '#1f6f78', '#e6b655', '#1c2541', '#f2e9dc', '#b3323e', '#1f6f78', '#f2e9dc', '#e6b655'].map((c, i) => (
        <rect key={i} x="-60" y={-60 + i * 48} width="520" height="50" fill={c} />
      ))}
    </g>
  </>
);

const Terrazzo: Draw = () => {
  const r = rng(4242);
  const colors = ['#e2654a', '#f0b84a', '#2f6f73', '#26324f', '#e9a6a0', '#8fb59b'];
  const chips = Array.from({ length: 70 }, () => {
    const cx = r() * 400;
    const cy = r() * 400;
    const s = 6 + r() * 20;
    const n = 3 + Math.floor(r() * 3);
    const start = r() * 6;
    const pts = Array.from({ length: n }, (_, i) => {
      const a = start + (i / n) * Math.PI * 2;
      const k = s * (0.6 + r() * 0.6);
      return `${(cx + Math.cos(a) * k).toFixed(1)},${(cy + Math.sin(a) * k).toFixed(1)}`;
    }).join(' ');
    return { pts, fill: colors[Math.floor(r() * colors.length)] };
  });
  return (
    <>
      <rect width="400" height="400" fill="#f5efe6" />
      {chips.map((c, i) => <polygon key={i} points={c.pts} fill={c.fill} />)}
    </>
  );
};

export const ARTS: { id: string; name: string; draw: Draw }[] = [
  { id: 'dusk', name: 'Dusk', draw: Dusk },
  { id: 'ridge', name: 'Ridge', draw: Ridge },
  { id: 'tide', name: 'Tide', draw: Tide },
  { id: 'contour', name: 'Contour', draw: Contour },
  { id: 'night', name: 'Night sky', draw: Night },
  { id: 'bauhaus', name: 'Bauhaus', draw: Bauhaus },
  { id: 'fern', name: 'Fern', draw: Fern },
  { id: 'sunburst', name: 'Sunburst', draw: Sunburst },
  { id: 'graph', name: 'Graph paper', draw: Graph },
  { id: 'orbit', name: 'Orbit', draw: Orbit },
  { id: 'ribbon', name: 'Ribbon', draw: Ribbon },
  { id: 'marble', name: 'Marble', draw: Marble },
  { id: 'terrazzo', name: 'Terrazzo', draw: Terrazzo },
];

export const CoverArt = memo(function CoverArt({ art }: { art: string }) {
  const uid = useId().replace(/\W/g, '');
  const found = ARTS.find((a) => a.id === art) ?? ARTS[0];
  return (
    <svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {found.draw(uid)}
    </svg>
  );
});
