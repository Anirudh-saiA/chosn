import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Badge } from '@chosn/ui';
import { TiltCard } from '@/components/fx/TiltCard';
import { SneakerArt } from '@/components/ui/SneakerArt';
import { formatInr, formatSize, SIGNAL_COPY, type SearchResultItem } from '@/lib/catalog';
import { paletteFor } from '@/lib/sneaker/palette';
import { resolveSneakerImage } from '@/lib/resolve-sneaker-image';

export interface SneakerCardProps {
  item: SearchResultItem;
}

/**
 * The premium catalog tile: designed sneaker art on a spotlight of the
 * shoe's own colour (or the real product image when one exists), mono
 * price + style code, signal badge. Tilt is progressive enhancement.
 */
export function SneakerCard({ item }: SneakerCardProps) {
  const href = `/sneakers/${encodeURIComponent(item.styleCode)}/${formatSize(item.defaultSize)}`;
  const copy = item.signal ? SIGNAL_COPY[item.signal] : null;
  const imageUrl = resolveSneakerImage(item.primaryImageUrl);
  const palette = paletteFor(item.colorway, item.brand);

  return (
    <TiltCard max={6}>
      <Link
        href={href}
        className="edge-glow ticks panel group relative flex h-full flex-col overflow-hidden transition-colors duration-300 hover:bg-vault-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-vault-deep/70">
          <div
            aria-hidden
            className="absolute inset-0 opacity-60 transition-opacity duration-500 group-hover:opacity-100"
            style={{ background: `radial-gradient(60% 60% at 50% 62%, ${palette.glow}55, transparent 72%)` }}
          />
          <div aria-hidden className="grid-lines !opacity-40" />
          {imageUrl ? (
            // Plain <img>: no known remote domain to allow-list yet.
            <img
              src={imageUrl}
              alt={`${item.brand} ${item.model} ${item.colorway}`}
              className="absolute inset-0 h-full w-full object-contain p-4 transition-transform duration-500 group-hover:scale-[1.05]"
            />
          ) : (
            <SneakerArt
              colorway={item.colorway}
              brand={item.brand}
              palette={palette}
              className="absolute inset-0 m-auto h-[82%] w-[88%] transition-transform duration-500 ease-out group-hover:-rotate-3 group-hover:scale-[1.06]"
            />
          )}
          {copy && (
            <span className="absolute left-3 top-3">
              <Badge state={copy.badge} className="!px-2.5 !py-0.5 !text-[0.7rem]">
                {copy.label}
              </Badge>
            </span>
          )}
          <span
            aria-hidden
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center border border-text/15 bg-vault-deep/70 text-text-soft opacity-0 backdrop-blur transition-all duration-300 group-hover:text-brass-bright group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-4">
          <div>
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-brass">{item.brand}</p>
            {/* h2: the page's h1 sits directly above this list of items. */}
            <h2 className="mt-1 font-display text-xl font-bold leading-tight tracking-tight text-text">{item.model}</h2>
            <p className="mt-0.5 truncate text-meta text-text-soft">{item.colorway}</p>
          </div>
          <div className="mt-auto flex items-end justify-between gap-3 border-t border-text/[0.07] pt-3">
            <div>
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-text-faint">Best available</p>
              {item.bestAvailablePrice !== null ? (
                <p className="mt-1 font-mono text-[1.6rem] font-medium leading-none tabular-nums text-text">
                  {formatInr(item.bestAvailablePrice)}
                </p>
              ) : (
                <p className="mt-1 font-mono text-data-inline text-text-soft">Unavailable</p>
              )}
            </div>
            <p className="font-mono text-meta text-text-faint">{item.styleCode}</p>
          </div>
        </div>
      </Link>
    </TiltCard>
  );
}

/** Skeleton twin of SneakerCard, for loading states. */
export function SneakerCardSkeleton() {
  return (
    <div className="panel flex h-full flex-col overflow-hidden" aria-hidden>
      <div className="skeleton aspect-[4/3]" />
      <div className="flex flex-col gap-3 p-4">
        <div className="skeleton h-3 w-16" />
        <div className="skeleton h-6 w-2/3" />
        <div className="skeleton h-3 w-1/2" />
        <div className="skeleton mt-3 h-8 w-28" />
      </div>
    </div>
  );
}
