import { Badge, Card } from '@chosn/ui';
import { formatInr, SIGNAL_COPY, type MarketIntelligence } from '@/lib/catalog';
import { TweenedPrice } from './TweenedPrice';

export interface MarketIntelligenceCardProps {
  data: MarketIntelligence | null;
  bestRetailerName: string | null;
}

/**
 * Density 8/10: no hero-card whitespace, no product photo — the numbers
 * are the content. Current price leads because it's what the page is
 * actually for; the three-cell stat row below shares one set of hairline
 * dividers rather than three separate cards, because these are one
 * connected reading (current vs. best vs. history), not three unrelated
 * facts — the divider earns its place by encoding that relationship.
 */
export function MarketIntelligenceCard({ data, bestRetailerName }: MarketIntelligenceCardProps) {
  const signal = data?.signal ?? 'insufficient_data';
  const copy = SIGNAL_COPY[signal];

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-meta uppercase tracking-[0.08em] text-text-faint">
            Current price
          </p>
          <div className="mt-1.5">
            <TweenedPrice
              value={data?.currentPrice ?? null}
              deltaPct={data?.trendPct ?? null}
              size="hero"
              formatter={formatInr}
            />
          </div>
          {data?.currentRetailerSlug && (
            <p className="mt-1 font-mono text-meta text-text-faint">
              at {data.currentRetailerSlug}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <Badge state={copy.badge}>{copy.label}</Badge>
          {!data?.sufficientData && (
            <p className="max-w-[18ch] text-right font-mono text-meta text-text-faint">
              {data?.daysHistory30d ?? 0} of 7 days tracked
            </p>
          )}
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-3 divide-x divide-moss/20 border-t border-moss/20 pt-5">
        <StatCell label="Best available" value={data?.bestAvailablePrice ?? null} sub={bestRetailerName} />
        <StatCell label="30-day avg" value={data?.avg30d ?? null} />
        <StatCell label="90-day avg" value={data?.avg90d ?? null} />
      </dl>
    </Card>
  );
}

function StatCell({
  label,
  value,
  sub,
}: {
  label: string;
  value: number | null;
  sub?: string | null;
}) {
  return (
    <div className="px-4 first:pl-0 last:pr-0">
      <dt className="font-mono text-meta uppercase tracking-[0.06em] text-text-faint">{label}</dt>
      <dd className="mt-1">
        <TweenedPrice value={value} formatter={formatInr} size="inline" unavailableLabel="—" />
      </dd>
      {sub && <dd className="mt-0.5 font-mono text-meta text-text-faint">{sub}</dd>}
    </div>
  );
}
