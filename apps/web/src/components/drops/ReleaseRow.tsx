'use client';

import Link from 'next/link';
import { ArrowUpRight, Clock, MapPin } from 'lucide-react';
import { formatDropPrice, type DropListItem } from '@/lib/drops';
import { countryOf, officialLinks, sourceLink } from '@/lib/drop-region';
import { resolveSneakerImage } from '@/lib/resolve-sneaker-image';
import { SneakerPlaceholderArt } from './SneakerPlaceholderArt';
import { ConfirmationBadge } from './ConfirmationBadge';

const STATUS: Record<DropListItem['status'], { label: string; cls: string } | null> = {
  live: { label: 'Live now', cls: 'bg-[#0A6B44] text-white' },
  upcoming: null,
  sold_out: { label: 'Released', cls: 'bg-[#0A0A0A]/10 text-[#0A0A0A]/70' },
};

/**
 * One release in the calendar's day sheet, week view and list. India rows show an India tag. "Released elsewhere" rows name the country
 * and carry a "Buy at official site" button for every official link we hold (https, official domain, opens in a new tab). With no such
 * link there is no button: the row says so and still links to its source, marked as a source and not a shop.
 */
export function ReleaseRow({ drop, scope }: { drop: DropListItem; scope: 'india' | 'elsewhere' }) {
  const { sneaker } = drop;
  const colourway = sneaker.colorway && sneaker.colorway !== 'Default' ? sneaker.colorway : '';
  const status = STATUS[drop.status];
  const country = scope === 'elsewhere' ? countryOf(drop) : null;
  const links = officialLinks(drop);
  const source = sourceLink(drop);
  const time = drop.releaseTime ? (drop.indiaTime?.split(', ').slice(-1)[0] ?? 'Time set') : 'Time TBA';
  const inStores = drop.indiaStatus === 'in_indian_stores' && !drop.regions.includes('india');
  const sourceVerb = drop.confirmation === 'reported' ? 'Reported by' : drop.confirmation === 'unconfirmed' ? 'Rumour from' : 'Confirmed by';

  return (
    <li className="flex gap-3.5 rounded-[20px] border border-[#0A0A0A]/10 bg-white p-3 transition-colors hover:border-[#0A0A0A]/40 sm:gap-4 sm:p-4">
      <Link
        href={`/drops/${drop.id}`}
        aria-hidden
        tabIndex={-1}
        className="relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-[16px] bg-[#F4F5F7] sm:h-24 sm:w-24"
      >
        <SneakerPlaceholderArt
          brand={sneaker.brand}
          model={sneaker.model}
          colorway={sneaker.colorway}
          imageUrl={resolveSneakerImage(sneaker.primaryImageUrl)}
          className="!aspect-auto h-full w-full border-0"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[#595959]">{sneaker.brand}</span>
          {status && <span className={`rounded-full px-2 py-0.5 font-mono text-[0.58rem] font-bold uppercase tracking-[0.1em] ${status.cls}`}>{status.label}</span>}
        </div>
        <Link href={`/drops/${drop.id}`} className="-my-1 flex min-h-[44px] flex-col justify-center rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A]">
          <span className="line-clamp-2 text-[1rem] font-bold leading-tight text-[#0A0A0A]">{sneaker.model}</span>
          {colourway && <span className="truncate text-[0.78rem] text-[#595959]">{colourway}</span>}
        </Link>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.78rem] font-semibold text-[#404040]">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-[#595959]" aria-hidden />
            {time}
          </span>
          <span className="tabular-nums text-[#0A0A0A]">{formatDropPrice(drop)}</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <ConfirmationBadge level={drop.confirmation} />
          {scope === 'india' && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#0A6B44] px-2.5 py-0.5 font-mono text-[0.6rem] font-extrabold uppercase tracking-[0.14em] text-[#0A6B44]">
              <MapPin className="h-3 w-3" aria-hidden /> {inStores ? 'In Indian stores' : 'India'}
            </span>
          )}
          {country && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#0A0A0A]/25 px-2.5 py-0.5 text-[0.72rem] font-semibold text-[#0A0A0A]">
              <span aria-hidden className="rounded-[6px] bg-[#0A0A0A] px-1.5 py-px font-mono text-[0.58rem] font-bold tracking-[0.08em] text-white">{country.code}</span>
              {country.name}
            </span>
          )}
        </div>

        {source && (
          <p className="break-words text-[0.72rem] text-[#595959]">
            {sourceVerb}{' '}
            <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[28px] items-center text-[#0A0A0A] underline underline-offset-2">
              {source.name}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </p>
        )}

        {scope === 'elsewhere' && (
          <div className="mt-1 flex flex-col gap-2">
            {links.length > 0 ? (
              <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {links.map((l) => (
                  <li key={l.url} className="flex flex-col">
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-[#0A0A0A] px-5 text-[0.85rem] font-semibold text-white transition-colors hover:bg-[#333] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A] focus-visible:ring-offset-2"
                    >
                      Buy at official site
                      <ArrowUpRight className="h-4 w-4" aria-hidden />
                      <span className="sr-only"> ({l.label}, opens in a new tab)</span>
                    </a>
                    <span className="mt-1 text-center font-mono text-[0.6rem] uppercase tracking-[0.1em] text-[#595959] sm:text-left">
                      {l.label} · {l.host}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[0.72rem] text-[#595959]">No official store link on file yet, so there is no buy button.</p>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
