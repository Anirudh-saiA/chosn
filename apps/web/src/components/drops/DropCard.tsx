'use client';

import Link from 'next/link';
import { Clock, MapPin } from 'lucide-react';
import { BrandMark } from '@/components/ui/BrandMark';
import { ShoePhoto } from '@/components/ui/ShoePhoto';
import { SneakerArt } from '@/components/ui/SneakerArt';
import { Reveal } from '@/components/fx/Reveal';
import { formatDropPrice, formatRegions, type DropListItem } from '@/lib/drops';
import { resolveSneakerImage } from '@/lib/resolve-sneaker-image';
import { paletteFor } from '@/lib/sneaker/palette';
import { releaseInstant } from './drop-instant';
import { useCountdown } from './drop-time';
import { ConfirmationBadge } from './ConfirmationBadge';
import { DropFollow } from './DropFollow';

function dayChip(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "2d 04h 12m": a quiet countdown for the card; the drop page has the big one. */
function Until({ iso }: { iso: string }) {
  const c = useCountdown(iso);
  if (!c) return null;
  if (c.done) return <span className="font-bold text-[#1F8A4C]">Releasing now</span>;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <span className="tabular-nums" title="Time until release">
      {c.d > 0 ? `${c.d}d ` : ''}
      {pad(c.h)}h {pad(c.m)}m
    </span>
  );
}

const STATUS: Record<DropListItem['status'], { label: string; cls: string }> = {
  live: { label: 'Live now', cls: 'bg-[#1F8A4C] text-white' },
  upcoming: { label: 'Upcoming', cls: 'bg-[#14213D] text-white' },
  sold_out: { label: 'Released', cls: 'bg-[#0A0A0A]/10 text-[#0A0A0A]/60' },
};

/**
 * A drop, drawn like the Compare card: the brand logo and a status pill, the name, colourway and price, the photo with the date on it,
 * then when it releases (Indian time), how firm the date is, and the Notify me / Follow buttons. The whole card opens the drop page;
 * the buttons sit above that link.
 */
export function DropCard({ drop, index = 0 }: { drop: DropListItem; index?: number }) {
  const { sneaker } = drop;
  const iso = releaseInstant(drop.releaseDate, drop.releaseTime, drop.releaseTimezone);
  const image = resolveSneakerImage(sneaker.primaryImageUrl);
  const palette = paletteFor(sneaker.colorway, sneaker.brand);
  const status = STATUS[drop.status];
  const href = `/drops/${drop.id}`;
  const colourway = sneaker.colorway && sneaker.colorway !== 'Default' ? sneaker.colorway : '';
  const regions = formatRegions(drop.regions);

  return (
    <Reveal as="li" delay={Math.min(index, 5) * 0.05} className="h-full">
      <article className="group relative flex h-full flex-col overflow-hidden rounded-[1.4rem] border border-[#0A0A0A]/10 bg-white transition-colors duration-300 hover:border-[#0A0A0A]">
        <Link href={href} aria-label={`${sneaker.brand} ${sneaker.model} ${sneaker.colorway}: drop details`} className="absolute inset-0 z-[5] rounded-[1.4rem]" />

        <div className="relative z-10 px-3.5 pt-3.5">
          <div className="flex items-start justify-between gap-3">
            <BrandMark brand={sneaker.brand} className="!h-5 !max-w-[4rem]" />
            <span className={`rounded-full px-2.5 py-1 font-display text-[0.8rem] uppercase leading-none tracking-[0.03em] ${status.cls}`}>{status.label}</span>
          </div>
          <h3 className="mt-1.5 line-clamp-2 font-display text-[clamp(1.15rem,1.5vw,1.35rem)] uppercase leading-[0.98] tracking-[0.01em] text-[#0A0A0A]">{sneaker.model}</h3>
          <p className="truncate text-[0.72rem] font-medium text-[#0A0A0A]/55">{colourway || ' '}</p>
          <p className="mt-1.5 font-sans text-[clamp(1.1rem,1.5vw,1.3rem)] font-extrabold leading-none tabular-nums text-[#0A0A0A]">{formatDropPrice(drop)}</p>
        </div>

        <div className="relative mt-3 aspect-[4/3] overflow-hidden bg-[#F4F5F7]">
          {image ? (
            <ShoePhoto
              key={image}
              src={image}
              alt={`${sneaker.brand} ${sneaker.model} ${sneaker.colorway}`}
              className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-[1.06]"
              fallback={<SneakerArt colorway={sneaker.colorway} brand={sneaker.brand} palette={palette} className="absolute inset-0 m-auto h-[80%] w-[88%]" />}
            />
          ) : (
            <SneakerArt colorway={sneaker.colorway} brand={sneaker.brand} palette={palette} className="absolute inset-0 m-auto h-[80%] w-[88%]" />
          )}
          <span className="pointer-events-none absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2.5 py-1 font-mono text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[#0A0A0A] shadow-[0_2px_10px_rgba(10,10,10,0.12)]">
            {dayChip(drop.releaseDate)}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-2.5 px-3.5 pb-3.5 pt-3">
          <div className="flex items-center justify-between gap-3 text-[0.78rem] font-semibold text-[#0A0A0A]/70">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[#0A0A0A]/45" aria-hidden />
              {drop.releaseTime ? (drop.indiaTime?.split(', ').slice(-1)[0] ?? 'Time set') : 'Time TBA'}
            </span>
            {drop.status === 'upcoming' && <Until iso={iso} />}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <ConfirmationBadge level={drop.confirmation} />
            {regions && (
              <span className="flex items-center gap-1 text-[0.72rem] text-[#0A0A0A]/50">
                <MapPin className="h-3 w-3" aria-hidden /> {regions}
              </span>
            )}
          </div>
          {drop.sourceName && (
            <p className="truncate text-[0.7rem] text-[#0A0A0A]/45">
              {drop.confirmation === 'reported' ? 'Reported by' : drop.confirmation === 'unconfirmed' ? 'Source:' : 'Confirmed by'}{' '}
              {drop.sourceUrl ? (
                <a href={drop.sourceUrl} target="_blank" rel="noopener noreferrer" className="relative z-10 text-[#0A0A0A] underline underline-offset-2">
                  {drop.sourceName}
                </a>
              ) : (
                drop.sourceName
              )}
            </p>
          )}
          <div className="relative z-10 mt-auto border-t border-[#0A0A0A]/8 pt-3">
            <DropFollow dropId={drop.id} brand={sneaker.brand} dateOnly={!drop.releaseTime} compact />
          </div>
        </div>
      </article>
    </Reveal>
  );
}
