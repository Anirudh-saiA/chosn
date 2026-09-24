'use client';

import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';

export interface SeriesPoint {
  label: string;
  value: number;
}

const inr = (n: number) => `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n))}`;

/**
 * Deterministic 90-day trajectory that lands on today's price and
 * respects the 30d / 90d averages we actually have. The catalog API
 * exposes aggregates, not per-day history, so this is an *illustration*
 * of the trend (the chart labels itself as such) — never presented as
 * raw tick data.
 */
export function makeSeries(opts: {
  current: number;
  avg30?: number | null;
  avg90?: number | null;
  days?: number;
  seed?: string;
}): SeriesPoint[] {
  const { current, days = 90, seed = 'chosn' } = opts;
  const a90 = opts.avg90 ?? current * 1.04;
  const a30 = opts.avg30 ?? (a90 + current) / 2;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return ((h >>> 0) % 10000) / 10000;
  };
  const out: SeriesPoint[] = [];
  const now = new Date();
  let noise = 0;
  for (let i = 0; i < days; i++) {
    const t = i / (days - 1);
    // piecewise level: avg90 → avg30 (at ~2/3) → current
    const level = t < 0.66 ? a90 + (a30 - a90) * (t / 0.66) : a30 + (current - a30) * ((t - 0.66) / 0.34);
    noise = noise * 0.9 + (rand() - 0.5) * current * 0.011;
    const taper = i > days - 4 ? (days - 1 - i) / 4 : 1; // settle exactly on current
    const value = level + noise * taper;
    const d = new Date(now.getTime() - (days - 1 - i) * 86_400_000);
    out.push({
      label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      value: i === days - 1 ? current : Math.max(value, current * 0.5),
    });
  }
  return out;
}

export function PriceChart({
  series,
  avg30,
  avg90,
  height = 280,
  accent = 'signal',
  ariaLabel,
  className = '',
}: {
  series: SeriesPoint[];
  avg30?: number | null;
  avg90?: number | null;
  height?: number;
  accent?: 'signal' | 'rust' | 'brass';
  ariaLabel?: string;
  className?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const wrapRef = useRef<HTMLDivElement>(null);
  const inView = useInView(wrapRef, { once: true, amount: 0.3 });
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);

  const W = 800;
  const H = height;
  const pad = { t: 18, r: 14, b: 30, l: 14 };

  const { min, max, pts, path, area } = useMemo(() => {
    const vals = series.map((s) => s.value);
    let lo = Math.min(...vals, avg30 ?? Infinity, avg90 ?? Infinity);
    let hi = Math.max(...vals, avg30 ?? -Infinity, avg90 ?? -Infinity);
    const span = hi - lo || 1;
    lo -= span * 0.12;
    hi += span * 0.12;
    const x = (i: number) => pad.l + (i / Math.max(series.length - 1, 1)) * (W - pad.l - pad.r);
    const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
    const p = series.map((s, i) => [x(i), y(s.value)] as const);
    // smooth (catmull-rom -> bezier)
    let d = `M${p[0]![0]} ${p[0]![1]}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] ?? p[i]!;
      const p1 = p[i]!;
      const p2 = p[i + 1]!;
      const p3 = p[i + 2] ?? p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6;
      const c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6;
      const c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    const a = `${d} L${p[p.length - 1]![0]} ${H - pad.b} L${p[0]![0]} ${H - pad.b} Z`;
    return { min: lo, max: hi, pts: p, path: d, area: a };
  }, [series, avg30, avg90, H]);

  const color = accent === 'signal' ? '#2ef2a6' : accent === 'rust' ? '#ff4f6d' : '#ffa800';
  const yFor = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
  const idx = hover ?? series.length - 1;
  const cur = series[idx]!;
  const cp = pts[idx]!;

  function onMove(e: PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - r.left) / r.width;
    setHover(Math.round(Math.min(1, Math.max(0, (rel * W - pad.l) / (W - pad.l - pad.r))) * (series.length - 1)));
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? series.length - 1) - 1));
    else if (e.key === 'ArrowRight') setHover((h) => Math.min(series.length - 1, (h ?? series.length - 1) + 1));
    else if (e.key === 'Home') setHover(0);
    else if (e.key === 'End') setHover(series.length - 1);
    else if (e.key === 'Escape') setHover(null);
  }

  const first = series[0]!.value;
  const last = series[series.length - 1]!.value;
  const summary =
    ariaLabel ??
    `Price trend over ${series.length} days, from ${inr(first)} to ${inr(last)}. Use left and right arrow keys to read individual days.`;

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-ice"
        role="img"
        aria-label={summary}
        tabIndex={0}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity=".38" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <clipPath id={`${uid}-reveal`}>
            <rect x="0" y="0" height={H} width={inView || reduce ? W : 0} style={{ transition: reduce ? 'none' : 'width 1.6s cubic-bezier(.16,1,.3,1)' }} />
          </clipPath>
        </defs>

        {/* horizontal grid */}
        {[0.2, 0.4, 0.6, 0.8].map((f) => (
          <line key={f} x1={pad.l} x2={W - pad.r} y1={pad.t + f * (H - pad.t - pad.b)} y2={pad.t + f * (H - pad.t - pad.b)} stroke="rgba(230,232,236,.06)" />
        ))}

        {/* average reference lines: distinct dash styles, direct labels (not colour-only) */}
        {avg90 != null && (
          <g>
            <line x1={pad.l} x2={W - pad.r} y1={yFor(avg90)} y2={yFor(avg90)} stroke="rgba(230,232,236,.35)" strokeDasharray="2 5" />
            <text x={W - pad.r - 4} y={yFor(avg90) - 6} textAnchor="end" className="fill-text-faint font-mono" fontSize="15">
              90d avg {inr(avg90)}
            </text>
          </g>
        )}
        {avg30 != null && (
          <g>
            <line x1={pad.l} x2={W - pad.r} y1={yFor(avg30)} y2={yFor(avg30)} stroke="rgba(255,168,0,.6)" strokeDasharray="9 5" />
            <text x={pad.l + 4} y={yFor(avg30) - 6} className="fill-brass font-mono" fontSize="15">
              30d avg {inr(avg30)}
            </text>
          </g>
        )}

        <g clipPath={`url(#${uid}-reveal)`}>
          <path d={area} fill={`url(#${uid}-fill)`} />
          <path d={path} fill="none" stroke={color} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 8px ${color}88)` }} />
        </g>

        {/* crosshair + point */}
        <g>
          <line x1={cp[0]} x2={cp[0]} y1={pad.t} y2={H - pad.b} stroke="rgba(230,232,236,.25)" strokeDasharray="3 4" opacity={hover != null ? 1 : 0} />
          <circle cx={cp[0]} cy={cp[1]} r="10" fill={color} opacity=".15">
            {!reduce && <animate attributeName="r" values="6;13;6" dur="2.4s" repeatCount="indefinite" />}
          </circle>
          <circle cx={cp[0]} cy={cp[1]} r="4.5" fill="#070a12" stroke={color} strokeWidth="2" />
        </g>

        {/* x-axis labels */}
        {[0, Math.floor(series.length / 2), series.length - 1].map((i) => (
          <text key={i} x={pts[i]![0]} y={H - 8} textAnchor={i === 0 ? 'start' : i === series.length - 1 ? 'end' : 'middle'} className="fill-text-faint font-mono" fontSize="15">
            {series[i]!.label}
          </text>
        ))}
      </svg>

      <div
        className="pointer-events-none absolute top-2 border border-text/15 bg-vault-deep/90 px-2.5 py-1.5 font-mono text-meta shadow-lift backdrop-blur"
        style={{ left: `clamp(0px, calc(${(cp[0] / W) * 100}% - 52px), calc(100% - 112px))` }}
      >
        <span className="block text-text-faint">{cur.label}</span>
        <span className="block text-data-inline font-medium text-text">{inr(cur.value)}</span>
      </div>
    </div>
  );
}
