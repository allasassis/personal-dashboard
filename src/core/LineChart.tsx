import { useEffect, useMemo, useRef, useState } from 'react';
import { fullDate, shortDate } from './dates';
import { fmtNum } from './ui';

export interface Point {
  x: number; // ms timestamp
  y: number;
  label?: string;
}

function niceTicks(min: number, max: number, count = 4) {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(6)));
  return ticks;
}

/** One series over real time, so gaps between entries look like gaps. */
export function LineChart({ points, unit, height = 220, name }: { points: Point[]; unit: string; height?: number; name: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(ref.current!);
    return () => ro.disconnect();
  }, []);

  const m = { top: 14, right: 58, bottom: 26, left: 38 };
  const innerW = Math.max(0, width - m.left - m.right);
  const innerH = height - m.top - m.bottom;

  const geo = useMemo(() => {
    if (!points.length) return null;
    const ticks = niceTicks(Math.min(...points.map((p) => p.y)), Math.max(...points.map((p) => p.y)));
    const y0 = ticks[0];
    const y1 = ticks[ticks.length - 1];
    const x0 = points[0].x;
    const x1 = points[points.length - 1].x;
    const sx = (x: number) => m.left + (x1 === x0 ? innerW / 2 : ((x - x0) / (x1 - x0)) * innerW);
    const sy = (y: number) => m.top + innerH - ((y - y0) / (y1 - y0)) * innerH;
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join('');
    const area = `${line}L${sx(x1).toFixed(1)} ${m.top + innerH}L${sx(x0).toFixed(1)} ${m.top + innerH}Z`;
    const count = Math.min(points.length, innerW < 320 ? 3 : 5);
    const xTicks = x1 === x0 ? [x0] : Array.from({ length: Math.max(2, count) }, (_, i) => x0 + ((x1 - x0) * i) / (Math.max(2, count) - 1));
    return { ticks, sx, sy, line, area, xTicks };
  }, [points, innerW, innerH, m.left, m.top]);

  const last = points[points.length - 1];
  const active = hover != null ? points[hover] : null;

  const onMove = (e: React.PointerEvent) => {
    if (!geo) return;
    const box = ref.current!.getBoundingClientRect();
    const px = e.clientX - box.left;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(geo.sx(p.x) - px) < Math.abs(geo.sx(points[best].x) - px)) best = i;
    });
    setHover(best);
  };

  const summary = last ? `${name}: ${points.length} entries, latest ${fmtNum(last.y)} ${unit} on ${fullDate(last.x)}. The entries are listed below the chart.` : `${name}: no entries`;

  return (
    <div className="chart" ref={ref} style={{ height }} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
      {geo && width > 0 && (
        <svg width={width} height={height} role="img" aria-label={summary}>
          {geo.ticks.map((t) => (
            <g key={t}>
              <line className="chart-grid" x1={m.left} x2={m.left + innerW} y1={geo.sy(t)} y2={geo.sy(t)} />
              <text className="chart-tick" x={m.left - 8} y={geo.sy(t) + 4} textAnchor="end">
                {fmtNum(t)}
              </text>
            </g>
          ))}
          {geo.xTicks.map((x, i) => (
            <text key={x} className="chart-tick" x={geo.sx(x)} y={height - 6} textAnchor={geo.xTicks.length === 1 ? 'middle' : i === 0 ? 'start' : i === geo.xTicks.length - 1 ? 'end' : 'middle'}>
              {shortDate(x)}
            </text>
          ))}
          <path className="chart-area" d={geo.area} />
          <path className="chart-line" d={geo.line} />
          {active && <line className="chart-cross" x1={geo.sx(active.x)} x2={geo.sx(active.x)} y1={m.top} y2={m.top + innerH} />}
          <circle className="chart-dot" cx={geo.sx((active ?? last).x)} cy={geo.sy((active ?? last).y)} r={5} />
          <text className="chart-end" x={geo.sx(last.x) + 10} y={geo.sy(last.y) + 4}>
            {fmtNum(last.y)} {unit}
          </text>
        </svg>
      )}
      {geo && active && (
        <div className="chart-tip" style={{ left: Math.min(Math.max(geo.sx(active.x), 70), width - 70), top: 0 }}>
          <strong className="num">
            {fmtNum(active.y)} {unit}
          </strong>
          <span>{fullDate(active.x)}</span>
          {active.label && <span>{active.label}</span>}
        </div>
      )}
    </div>
  );
}
