'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatInr } from '@/lib/catalog';

interface Point {
  day: string;
  bestPrice: number;
  bestStore: string;
  stores: Array<{ slug: string; name: string; price: number }>;
}
interface History {
  points: Point[];
  since: string | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const RANGES = [
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: 'All', days: 730 },
] as const;
const STORE_COLORS = ['#D97E00', '#2F63C8', '#3E8E5A', '#7E57C2', '#D62F2F', '#0F8B8D'];

const dayMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const label = (d: string) => new Date(dayMs(d)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/**
 * Real recorded prices for this shoe and size: one point per day a price was actually seen, one line per store,
 * and the day's cheapest as the dark line. Nothing is interpolated or estimated — before a few days of data have
 * been collected it says so instead of drawing a trend.
 */
export function PriceHistory({ styleCode, size }: { styleCode: string; size: number }) {
  const [range, setRange] = useState<(typeof RANGES)[number]['days']>(90);
  const [history, setHistory] = useState<History | null>(null);
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setHistory(null);
    setFailed(false);
    fetch(`${API_URL}/catalog/${encodeURIComponent(styleCode)}/${size}/history?days=${range}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<History>) : Promise.reject(new Error(String(r.status)))))
      .then(setHistory)
      .catch((e) => !ctrl.signal.aborted && (console.warn('price history unavailable', e), setFailed(true)));
    return () => ctrl.abort();
  }, [styleCode, size, range]);

  const points = history?.points ?? [];
  const stores = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of points) for (const s of p.stores) m.set(s.slug, s.name);
    return [...m.entries()].map(([slug, name], i) => ({ slug, name, color: STORE_COLORS[i % STORE_COLORS.length] as string }));
  }, [points]);

  const W = 800;
  const H = 300;
  const pad = { l: 64, r: 16, t: 16, b: 34 };
  const prices = points.flatMap((p) => p.stores.map((s) => s.price));
  const lo = prices.length ? Math.min(...prices) : 0;
  const hi = prices.length ? Math.max(...prices) : 1;
  const span = Math.max(hi - lo, hi * 0.04, 1);
  const yMin = lo - span * 0.15;
  const yMax = hi + span * 0.15;
  const t0 = points.length ? dayMs(points[0]!.day) : 0;
  const t1 = points.length ? dayMs(points[points.length - 1]!.day) : 1;
  const x = (d: string) => (points.length < 2 ? (pad.l + W - pad.r) / 2 : pad.l + ((dayMs(d) - t0) / (t1 - t0)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - (v - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);
  const path = (get: (p: Point) => number | null) =>
    points
      .map((p) => ({ p, v: get(p) }))
      .filter((q): q is { p: Point; v: number } => q.v !== null)
      .map((q, i) => `${i === 0 ? 'M' : 'L'}${x(q.p.day).toFixed(1)},${y(q.v).toFixed(1)}`)
      .join(' ');

  const active = hover !== null ? points[hover] : null;
  const first = points[0];
  const latest = points[points.length - 1];
  const change = first && latest && points.length > 1 ? latest.bestPrice - first.bestPrice : null;

  return (
    <section aria-labelledby="chart-h" className="rounded-3xl border border-text/10 bg-white p-5 sm:p-7">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Real prices</p>
          <h2 id="chart-h" className="mt-2 font-display text-2xl font-bold tracking-tight text-text sm:text-3xl">
            Price history
          </h2>
          <p className="mt-1.5 text-[0.85rem] text-text-soft">
            {history && history.since
              ? `Recorded once a day since ${label(history.since)} · ${points.length} ${points.length === 1 ? 'day' : 'days'} so far`
              : 'Prices are recorded once a day.'}
            {change !== null && change !== 0 && (
              <span className={`ml-2 font-mono font-semibold ${change < 0 ? 'text-[#2E7D4F]' : 'text-[#B4452A]'}`}>
                {change < 0 ? '▼' : '▲'} {formatInr(Math.abs(change))} since then
              </span>
            )}
          </p>
        </div>
        <div role="group" aria-label="Chart range" className="flex overflow-hidden rounded-full border border-text/15">
          {RANGES.map((r) => (
            <button
              key={r.label}
              type="button"
              aria-pressed={range === r.days}
              onClick={() => setRange(r.days)}
              className={`min-h-[40px] min-w-[56px] px-4 font-mono text-[0.74rem] transition-colors ${range === r.days ? 'bg-text font-semibold text-white' : 'text-text-soft hover:bg-text/5 hover:text-text'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {failed ? (
        <p className="py-10 text-center text-[0.9rem] text-text-soft">Price history is unavailable right now.</p>
      ) : !history ? (
        <div className="skeleton h-[300px] rounded-2xl" aria-label="Loading price history" />
      ) : points.length === 0 ? (
        <p className="py-10 text-center text-[0.9rem] text-text-soft">No prices recorded for this size yet. The chart starts as soon as the first daily update runs.</p>
      ) : (
        <>
          <div className="relative">
            <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Price history over ${points.length} recorded days`} onMouseLeave={() => setHover(null)}>
              {[0, 0.25, 0.5, 0.75, 1].map((f) => {
                const v = yMin + (yMax - yMin) * f;
                return (
                  <g key={f}>
                    <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#0A0A0A" strokeOpacity={0.07} />
                    <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" className="fill-text-faint font-mono" fontSize={11}>
                      {formatInr(v)}
                    </text>
                  </g>
                );
              })}
              {points.length > 1 &&
                [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])].map((i) => (
                  <text key={i} x={x(points[i]!.day)} y={H - 10} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} className="fill-text-faint font-mono" fontSize={11}>
                    {label(points[i]!.day)}
                  </text>
                ))}

              {stores.map((s) => (
                <path key={s.slug} d={path((p) => p.stores.find((q) => q.slug === s.slug)?.price ?? null)} fill="none" stroke={s.color} strokeWidth={1.6} strokeOpacity={0.75} />
              ))}
              <path d={path((p) => p.bestPrice)} fill="none" stroke="#0A0A0A" strokeWidth={2.6} strokeLinejoin="round" />
              {points.map((p, i) => (
                <g key={p.day}>
                  {stores.map((s) => {
                    const v = p.stores.find((q) => q.slug === s.slug)?.price;
                    return v === undefined ? null : <circle key={s.slug} cx={x(p.day)} cy={y(v)} r={3} fill={s.color} />;
                  })}
                  <circle cx={x(p.day)} cy={y(p.bestPrice)} r={hover === i ? 6 : 4.5} fill="#0A0A0A" stroke="#fff" strokeWidth={1.5} />
                  <rect x={x(p.day) - 24} y={pad.t} width={48} height={H - pad.t - pad.b} fill="transparent" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} />
                </g>
              ))}
            </svg>

            {active && (
              <div className="pointer-events-none absolute right-2 top-2 min-w-[11rem] rounded-xl border border-text/10 bg-white/95 p-3 shadow-lg" role="status">
                <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.12em] text-text-faint">{label(active.day)}</p>
                <ul className="mt-1.5 space-y-0.5">
                  {[...active.stores].sort((a, b) => a.price - b.price).map((s) => (
                    <li key={s.slug} className="flex items-center justify-between gap-4 text-[0.8rem]">
                      <span className="flex items-center gap-1.5 text-text-soft">
                        <span className="h-2 w-2 rounded-full" style={{ background: stores.find((q) => q.slug === s.slug)?.color }} aria-hidden />
                        {s.name}
                      </span>
                      <span className={`font-mono tabular-nums ${s.price === active.bestPrice ? 'font-bold text-text' : 'text-text-soft'}`}>{formatInr(s.price)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <ul className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.78rem] text-text-soft">
            <li className="flex items-center gap-1.5">
              <span className="h-[3px] w-5 rounded bg-text" aria-hidden /> Cheapest each day
            </li>
            {stores.map((s) => (
              <li key={s.slug} className="flex items-center gap-1.5">
                <span className="h-[3px] w-5 rounded" style={{ background: s.color }} aria-hidden /> {s.name}
              </li>
            ))}
          </ul>
          {points.length < 3 && (
            <p className="mt-3 rounded-xl bg-[#F1F7FB] px-4 py-3 text-[0.8rem] text-text-soft">
              Only {points.length === 1 ? 'one day' : `${points.length} days`} of real prices so far. The lines fill in as each daily update runs, so trends become readable after a few days.
            </p>
          )}
        </>
      )}
    </section>
  );
}
