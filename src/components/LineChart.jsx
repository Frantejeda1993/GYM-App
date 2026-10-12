import { useState } from 'react';

// Gráfico de línea de una serie (SVG propio, sin librerías). Toca un punto para ver el detalle.
// points: [{ x: etiqueta, y: número, tip: texto }]
export default function LineChart({ points, unit = '', height = 200, ariaLabel }) {
  const [active, setActive] = useState(points.length - 1);
  const W = 340;
  const H = height;
  const pad = { l: 40, r: 14, t: 16, b: 28 };
  const ys = points.map((p) => p.y);
  let lo = Math.min(...ys);
  let hi = Math.max(...ys);
  if (lo === hi) {
    lo -= 5;
    hi += 5;
  }
  const span = hi - lo;
  const step = niceStep(span / 3);
  const yMin = Math.floor((lo - span * 0.1) / step) * step;
  const yMax = Math.ceil((hi + span * 0.1) / step) * step;
  const ticks = [];
  for (let v = yMin; v <= yMax + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  const X = (i) => (points.length === 1 ? (pad.l + W - pad.r) / 2 : pad.l + (i * (W - pad.l - pad.r)) / (points.length - 1));
  const Y = (v) => pad.t + ((yMax - v) / (yMax - yMin)) * (H - pad.t - pad.b);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(' ');
  const a = points[active];
  const fmt = (v) => String(v).replace('.', ',');

  return (
    <figure className="chart">
      {a && (
        <figcaption className="chart-tip">
          <strong>{fmt(a.y)} {unit}</strong>
          <span>{a.tip}</span>
        </figcaption>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={Y(t)} y2={Y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={pad.l - 6} y={Y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{fmt(t)}</text>
          </g>
        ))}
        <text x={X(0)} y={H - 8} textAnchor={points.length > 1 ? 'start' : 'middle'} fontSize="11" fill="var(--muted)">{points[0]?.x}</text>
        {points.length > 1 && <text x={X(points.length - 1)} y={H - 8} textAnchor="end" fontSize="11" fill="var(--muted)">{points.at(-1).x}</text>}
        {a && <line x1={X(active)} x2={X(active)} y1={pad.t} y2={H - pad.b} stroke="var(--muted)" strokeWidth="1" strokeDasharray="3 3" />}
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i} onClick={() => setActive(i)} style={{ cursor: 'pointer' }}>
            <circle cx={X(i)} cy={Y(p.y)} r="14" fill="transparent" />
            <circle cx={X(i)} cy={Y(p.y)} r={i === active ? 5.5 : 4} fill={i === active ? 'var(--accent)' : 'var(--bg)'} stroke="var(--accent)" strokeWidth="2" />
          </g>
        ))}
      </svg>
    </figure>
  );
}

function niceStep(raw) {
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}
