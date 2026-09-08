import Link from 'next/link';
import { formatInr } from '@/lib/catalog';
import { formatReleaseTime, type DropListItem } from '@/lib/drops';
import { DropStatusBadge } from './DropStatusBadge';
import { NotifyToggle } from './NotifyToggle';
import { SneakerPlaceholderArt } from './SneakerPlaceholderArt';

/**
 * The list view's row (Day 15 task 1) — image, name, release time,
 * live status badge, inline "Notify me." Density 4-5/10: generous
 * padding, one row per drop rather than a packed table, per the
 * brief's editorial-mode dial reset (contrast with the price page's
 * 8/10 terminal density).
 */
export function DropCard({ drop }: { drop: DropListItem }) {
  const { sneaker } = drop;

  return (
    <li className="flex gap-4 border-b border-moss/15 py-5 last:border-b-0 sm:gap-6 sm:py-6">
      <Link href={`/drops/${drop.id}`} className="block w-24 shrink-0 sm:w-32">
        <SneakerPlaceholderArt
          brand={sneaker.brand}
          model={sneaker.model}
          colorway={sneaker.colorway}
          imageUrl={sneaker.primaryImageUrl}
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/drops/${drop.id}`} className="group">
              <p className="font-mono text-meta uppercase tracking-[0.06em] text-text-faint">{sneaker.brand}</p>
              <h3 className="font-display text-body font-semibold text-text group-hover:text-brass">
                {sneaker.model}
              </h3>
              <p className="text-meta text-text-soft">{sneaker.colorway}</p>
            </Link>
          </div>
          <DropStatusBadge dropEventId={drop.id} initialStatus={drop.status} />
        </div>

        <p className="font-mono text-data-inline text-text-soft">
          {drop.releaseTime ? formatReleaseTime(drop.releaseTime) : 'Time TBA'}
          {drop.retailPrice && (
            <span className="text-text-faint"> · {formatInr(Number(drop.retailPrice))}</span>
          )}
        </p>

        <div className="mt-1">
          <NotifyToggle brand={sneaker.brand} styleCode={sneaker.styleCode} modelLabel={`${sneaker.brand} ${sneaker.model}`} />
        </div>
      </div>
    </li>
  );
}
