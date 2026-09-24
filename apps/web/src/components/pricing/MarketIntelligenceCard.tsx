'use client';

// Explicit as of Day 15: real build error caught rendering this from a
// new Server Component caller (LivePricePreview, on the drop-detail
// page) — this component was always client-rendered in practice (its
// only caller before today, PriceComparisonView, is itself 'use
// client', so the boundary was implicit and never mattered), but
// TweenedPrice's `formatter` prop is a plain function, and a function
// can't cross an *explicit* server->client boundary as a prop. Marking
// this file 'use client' moves that boundary to here, where every prop
// (`data`, `bestRetailerName`) is plain serializable data — `formatInr`
// itself now just runs as ordinary client code, never serialized.
import { Badge } from '@chosn/ui';
import { formatInr, SIGNAL_COPY, type MarketIntelligence } from '@/lib/catalog';
import { TweenedPrice } from './TweenedPrice';

export interface MarketIntelligenceCardProps {
  data: MarketIntelligence | null;
  bestRetailerName: string | null;
}

/**
 * Dense terminal readout: the current price is the giant figure, the
 * three-cell stat row below shares one set of hairline dividers because
 * these are one connected reading (best vs. history vs. now).
 */
export function MarketIntelligenceCard({ data, bestRetailerName }: MarketIntelligenceCardProps) {
  const signal = data?.signal ?? 'insufficient_data';
  const copy = SIGNAL_COPY[signal];
  const current = data?.currentPrice ?? null;

  return (
    <section aria-label="Market intelligence" className="panel ticks relative overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-text/[0.08] bg-vault-deep/60 px-5 py-2.5">
        <p className="eyebrow flex items-center gap-2 whitespace-nowrap">
          <span className="live-dot" aria-hidden /> Market readout
        </p>
        <Badge state={copy.badge} className="!px-2.5 !text-[0.72rem] sm:!text-data-delta">{copy.label}</Badge>
      </div>

      <div className="px-5 pb-5 pt-5 sm:px-6">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-text-faint">Current price</p>
        <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-1">
          <TweenedPrice
            value={current}
            deltaPct={data?.trendPct ?? null}
            size="hero"
            formatter={formatInr}
            className="[&>span:first-child]:!text-[clamp(2.75rem,7vw,4.25rem)] [&>span:first-child]:!leading-none [&>span:first-child]:!tracking-tight"
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          {data?.currentRetailerSlug && (
            <p className="font-mono text-meta text-text-soft">
              at <span className="text-text">{data.currentRetailerSlug}</span>
            </p>
          )}
          {!data?.sufficientData && (
            <p className="font-mono text-meta text-text-soft">{data?.daysHistory30d ?? 0} of 7 days tracked</p>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-3 divide-x divide-text/[0.08] border-t border-text/[0.08] bg-vault-deep/40">
        <StatCell label="Best available" value={data?.bestAvailablePrice ?? null} sub={bestRetailerName} highlight />
        <StatCell label="30-day avg" value={data?.avg30d ?? null} current={current} />
        <StatCell label="90-day avg" value={data?.avg90d ?? null} current={current} />
      </dl>
    </section>
  );
}

function StatCell({
  label,
  value,
  sub,
  current,
  highlight = false,
}: {
  label: string;
  value: number | null;
  sub?: string | null;
  /** When given, shows how today's price compares to this average. */
  current?: number | null;
  highlight?: boolean;
}) {
  const diff = current != null && value != null && value > 0 ? ((current - value) / value) * 100 : null;
  return (
    <div className="min-w-0 px-3 py-4 sm:px-5">
      <dt className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-text-faint sm:text-[0.68rem]">{label}</dt>
      <dd className={`mt-1.5 font-mono text-base font-medium tabular-nums sm:text-xl ${highlight ? 'text-brass-bright' : 'text-text'}`}>
        <TweenedPrice value={value} formatter={formatInr} size="inline" unavailableLabel="—" className="[&>span:first-child]:!text-inherit [&>span:first-child]:!text-[length:inherit]" />
      </dd>
      {sub && <dd className="mt-0.5 truncate font-mono text-meta text-text-soft">{sub}</dd>}
      {diff != null && Math.abs(diff) >= 0.05 && (
        <dd className={`mt-0.5 font-mono text-meta ${diff < 0 ? 'text-signal' : 'text-rust'}`}>
          <span className="text-text-faint">Now</span> {diff < 0 ? '▼' : '▲'} {Math.abs(diff).toFixed(1)}%
        </dd>
      )}
    </div>
  );
}
