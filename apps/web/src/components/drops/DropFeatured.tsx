'use client';

import Link from 'next/link';
import { ArrowRight, Clock, MapPin } from 'lucide-react';
import { buttonVariantClass } from '@chosn/ui';
import { Reveal } from '@/components/fx/Reveal';
import { formatInr } from '@/lib/catalog';
import { formatRegions, formatReleaseTime, type DropListItem } from '@/lib/drops';
import { resolveSneakerImage } from '@/lib/resolve-sneaker-image';
import { releaseInstant } from './drop-instant';
import { Countdown } from './drop-time';
import { DropStatusBadge } from './DropStatusBadge';
import { SneakerPlaceholderArt } from './SneakerPlaceholderArt';

/** The single most relevant drop: a live one if any, else the soonest upcoming. */
export function pickFeaturedDrop(drops: DropListItem[]): DropListItem | null {
  const live = drops.find((d) => d.status === 'live');
  if (live) return live;
  const upcoming = drops
    .filter((d) => d.status === 'upcoming')
    .sort(
      (a, b) =>
        new Date(releaseInstant(a.releaseDate, a.releaseTime, a.releaseTimezone)).getTime() -
        new Date(releaseInstant(b.releaseDate, b.releaseTime, b.releaseTimezone)).getTime(),
    );
  return upcoming[0] ?? null;
}

function releaseDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function DropFeatured({ drop }: { drop: DropListItem }) {
  const { sneaker } = drop;
  const iso = releaseInstant(drop.releaseDate, drop.releaseTime, drop.releaseTimezone);
  const isLive = drop.status === 'live';

  return (
    <Reveal>
      <section
        aria-label={isLive ? 'Live now' : 'Next drop'}
        className={`edge-glow ticks panel relative grid overflow-hidden lg:grid-cols-[1.1fr_1fr] ${isLive ? 'shadow-glow-signal' : ''}`}
      >
        <div className="relative min-h-[16rem] border-b border-text/[0.08] lg:min-h-[26rem] lg:border-b-0 lg:border-r">
          <SneakerPlaceholderArt
            brand={sneaker.brand}
            model={sneaker.model}
            colorway={sneaker.colorway}
            imageUrl={resolveSneakerImage(sneaker.primaryImageUrl)}
            aspect="wide"
            className="!absolute !inset-0 !aspect-auto h-full w-full border-0"
          />
          <p className="eyebrow absolute left-4 top-4 flex items-center gap-2 sm:left-6 sm:top-6">
            {isLive ? <span className="live-dot text-signal" aria-hidden /> : <span className="live-dot text-rust" aria-hidden />}
            {isLive ? 'Live now' : 'Next drop'}
          </p>
        </div>

        <div className="flex flex-col justify-center gap-6 p-6 sm:p-8 lg:p-10">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-brass">{sneaker.brand}</p>
              <DropStatusBadge dropEventId={drop.id} initialStatus={drop.status} />
            </div>
            <h2 className="mt-2 font-display text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1] tracking-tight text-text">
              {sneaker.model}
            </h2>
            <p className="mt-2 text-lg text-text-soft">{sneaker.colorway}</p>
          </div>

          {isLive ? (
            <p className="font-mono text-ui-label font-semibold uppercase tracking-[0.14em] text-signal">Releasing now — live at retail</p>
          ) : (
            <Countdown iso={iso} size="lg" />
          )}

          <dl className="grid grid-cols-2 gap-4 border-t border-text/[0.08] pt-5 font-mono sm:grid-cols-3">
            <div>
              <dt className="flex items-center gap-1.5 text-[0.65rem] uppercase tracking-[0.18em] text-text-faint">
                <Clock className="h-3 w-3" aria-hidden /> Release
              </dt>
              <dd className="mt-1 text-data-inline text-text">
                {releaseDay(drop.releaseDate)} · {drop.releaseTime ? formatReleaseTime(drop.releaseTime) : 'TBA'}
              </dd>
            </div>
            <div>
              <dt className="text-[0.65rem] uppercase tracking-[0.18em] text-text-faint">Retail</dt>
              <dd className="mt-1 text-data-inline text-text">{drop.retailPrice ? formatInr(Number(drop.retailPrice)) : 'TBA'}</dd>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <dt className="flex items-center gap-1.5 text-[0.65rem] uppercase tracking-[0.18em] text-text-faint">
                <MapPin className="h-3 w-3" aria-hidden /> Regions
              </dt>
              <dd className="mt-1 text-data-inline text-text">{formatRegions(drop.regions) || '—'}</dd>
            </div>
          </dl>

          <div>
            <Link href={`/drops/${drop.id}`} className={buttonVariantClass('primary', 'min-h-[44px]')}>
              Drop details <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </Reveal>
  );
}
