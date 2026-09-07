import Link from 'next/link';
import { Badge, Card, PriceFigure } from '@chosn/ui';
import { formatInr, formatSize, SIGNAL_COPY, type SearchResultItem } from '@/lib/catalog';

export interface SneakerCardProps {
  item: SearchResultItem;
}

/**
 * Density 5-6/10 here, deliberately looser than the price-terminal page's
 * 8/10 — a browse grid is scanned differently than a comparison table,
 * and needs room for the eye to land on one card at a time. No hover
 * entrance/scroll animation (motion stays feedback-only per the brief);
 * the only interactive state is the existing border-color hover already
 * used elsewhere on the site.
 */
export function SneakerCard({ item }: SneakerCardProps) {
  const href = `/sneakers/${encodeURIComponent(item.styleCode)}/${formatSize(item.defaultSize)}`;
  const copy = item.signal ? SIGNAL_COPY[item.signal] : null;

  return (
    <Link href={href} className="group block">
      <Card className="flex h-full flex-col gap-4 p-6 transition-colors duration-150 ease-chosn group-hover:border-moss">
        <div className="flex aspect-square items-center justify-center border border-moss/15 bg-vault-recessed">
          {item.primaryImageUrl ? (
            // Plain <img>, not next/image — the catalog has no real
            // images yet, so there's no known remote domain to allow-list
            // in next.config.mjs; revisit once real image URLs exist.
            <img
              src={item.primaryImageUrl}
              alt={`${item.brand} ${item.model} ${item.colorway}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="font-mono text-meta uppercase tracking-[0.08em] text-text-faint">
              {item.styleCode}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1">
          <p className="font-mono text-meta uppercase tracking-[0.06em] text-text-faint">
            {item.brand}
          </p>
          {/* h2, not h3 — the page's only other heading is the h1 above
              these cards, and each card is a distinct item in that list,
              not a subsection three levels deep. Caught by Lighthouse's
              heading-order audit, not by eye. */}
          <h2 className="font-display text-body font-semibold leading-snug text-text">
            {item.model}
          </h2>
          <p className="text-meta text-text-soft">{item.colorway}</p>
        </div>

        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-meta text-text-faint">Best available</p>
            {item.bestAvailablePrice !== null ? (
              <PriceFigure value={formatInr(item.bestAvailablePrice)} />
            ) : (
              <p className="font-mono text-data-inline text-text-soft">Currently unavailable</p>
            )}
          </div>
          {copy && <Badge state={copy.badge}>{copy.label}</Badge>}
        </div>
      </Card>
    </Link>
  );
}
