import Link from 'next/link';
import { BellRing, Clock } from 'lucide-react';
import { formatInr } from '@/lib/catalog';
import { formatReleaseTime, type DropListItem } from '@/lib/drops';
import { resolveSneakerImage } from '@/lib/resolve-sneaker-image';
import { Reveal } from '@/components/fx/Reveal';
import { releaseInstant } from './drop-instant';
import { Countdown } from './drop-time';
import { DropStatusBadge } from './DropStatusBadge';
import { NotifyToggle } from './NotifyToggle';
import { SneakerPlaceholderArt } from './SneakerPlaceholderArt';

function dayChip(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * A drop tile: sneaker over a colourway spotlight, live status pill,
 * name, retail price, countdown (until release) and the notify chips.
 */
export function DropCard({ drop, index = 0 }: { drop: DropListItem; index?: number }) {
  const { sneaker } = drop;
  const iso = releaseInstant(drop.releaseDate, drop.releaseTime, drop.releaseTimezone);

  return (
    <Reveal as="li" delay={Math.min(index, 5) * 0.05} className="h-full">
      <article className="edge-glow ticks panel group relative flex h-full flex-col overflow-hidden transition-colors hover:bg-vault-high">
        <Link
          href={`/drops/${drop.id}`}
          aria-label={`${sneaker.brand} ${sneaker.model} ${sneaker.colorway} — drop details`}
          className="relative block h-44 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ice"
        >
          <SneakerPlaceholderArt
            brand={sneaker.brand}
            model={sneaker.model}
            colorway={sneaker.colorway}
            imageUrl={resolveSneakerImage(sneaker.primaryImageUrl)}
            aspect="wide"
            className="!aspect-auto h-full w-full border-0 transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        </Link>
        <DropStatusBadge dropEventId={drop.id} initialStatus={drop.status} className="absolute left-3 top-3" />
        <p className="pointer-events-none absolute right-3 top-3 border border-text/[0.12] bg-vault-deep/80 px-2.5 py-1 font-mono text-[0.65rem] font-semibold uppercase tracking-wider text-text">
          {dayChip(drop.releaseDate)}
        </p>

        <div className="flex flex-1 flex-col gap-4 p-5">
          <div>
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-brass">{sneaker.brand}</p>
            <h3 className="mt-1 font-display text-2xl font-semibold leading-tight text-text">
              <Link href={`/drops/${drop.id}`} className="hover:text-brass-bright focus-visible:outline-none focus-visible:underline">
                {sneaker.model}
              </Link>
            </h3>
            <p className="text-meta text-text-soft">{sneaker.colorway}</p>
          </div>

          <div className="flex items-center justify-between gap-3 font-mono text-meta text-text-soft">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-brass" aria-hidden />
              {drop.releaseTime ? formatReleaseTime(drop.releaseTime) : 'Time TBA'}
            </span>
            <span className="flex items-center gap-1.5 text-text">
              {drop.retailPrice ? formatInr(Number(drop.retailPrice)) : 'TBA'}
            </span>
          </div>

          {drop.status === 'upcoming' && <Countdown iso={iso} />}
          {drop.status === 'live' && (
            <p className="font-mono text-ui-label font-semibold uppercase tracking-[0.14em] text-signal">Releasing now</p>
          )}

          <div className="mt-auto border-t border-text/[0.08] pt-4">
            <p className="mb-2 flex items-center gap-1.5 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-text-faint">
              <BellRing className="h-3 w-3 text-brass" aria-hidden /> Alerts
            </p>
            <NotifyToggle brand={sneaker.brand} styleCode={sneaker.styleCode} modelLabel={`${sneaker.brand} ${sneaker.model}`} />
          </div>
        </div>
      </article>
    </Reveal>
  );
}
