'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { SneakerArt } from '@/components/ui/SneakerArt';
import { formatInr, formatSize, type SearchResultItem } from '@/lib/catalog';
import { paletteFor } from '@/lib/sneaker/palette';
import { resolveSneakerImage } from '@/lib/resolve-sneaker-image';
import { ShoePhoto } from '@/components/ui/ShoePhoto';
import { WishlistButton } from '@/components/wishlist/WishlistButton';
import { CompareToggle } from '@/components/compare/CompareToggle';

export interface SneakerCardProps {
  item: SearchResultItem;
}

const SIGNAL_PILL: Partial<Record<NonNullable<SearchResultItem['signal']>, { label: string; cls: string }>> = {
  good_time_to_buy: { label: 'Buy', cls: 'bg-[#0A0A0A] text-white' },
  consider_waiting: { label: 'Wait', cls: 'bg-[#FF7A1A] text-[#0A0A0A]' },
};

const MAX_DOTS = 6;

/**
 * One card per model. The shoe's colourways sit under the name as small photos: hover or tap one and the big photo,
 * colour name, price and link all switch to it. Marketplace-style: a square photo frame, brand, model, best price.
 * The whole card is one link (a stretched link on the model name); the colour buttons sit above it.
 */
export function SneakerCard({ item }: SneakerCardProps) {
  // The API sends every matching colourway of the model, the shown one first; older / single results just have this one.
  const colours =
    item.colours && item.colours.length > 0
      ? item.colours
      : [{ styleCode: item.styleCode, colorway: item.colorway, primaryImageUrl: item.primaryImageUrl, defaultSize: item.defaultSize, bestAvailablePrice: item.bestAvailablePrice }];
  const [selected, setSelected] = useState(0);
  const cur = colours[Math.min(selected, colours.length - 1)] ?? colours[0]!;

  const href = `/sneakers/${encodeURIComponent(cur.styleCode)}/${formatSize(cur.defaultSize)}`;
  const pill = selected === 0 && item.signal ? SIGNAL_PILL[item.signal] : undefined;
  const imageUrl = resolveSneakerImage(cur.primaryImageUrl);
  const palette = paletteFor(cur.colorway, item.brand);
  const shown = colours.slice(0, MAX_DOTS);
  const extra = colours.length - shown.length;

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-[#0A0A0A]/10 bg-white transition-colors duration-300 hover:border-[#0A0A0A]">
      <div className={`relative aspect-square overflow-hidden ${imageUrl ? 'bg-white' : ''}`} style={imageUrl ? undefined : { background: `linear-gradient(160deg, ${palette.glow}40, ${palette.glow}14)` }}>
        {imageUrl ? (
          // Plain <img>: no known remote domain to allow-list yet. Falls back to the illustration if the photo can't load.
          <ShoePhoto
            key={imageUrl}
            src={imageUrl}
            alt={`${item.brand} ${item.model} ${cur.colorway}`}
            className="absolute inset-0 h-full w-full object-contain p-8 transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            fallback={<SneakerArt colorway={cur.colorway} brand={item.brand} palette={palette} className="absolute inset-0 m-auto h-[82%] w-[88%]" />}
          />
        ) : (
          <SneakerArt
            colorway={cur.colorway}
            brand={item.brand}
            palette={palette}
            className="absolute inset-0 m-auto h-[82%] w-[88%] transition-transform duration-500 ease-out group-hover:-rotate-3 group-hover:scale-[1.06]"
          />
        )}
        {pill && (
          <span className={`absolute left-4 top-4 rounded-full px-3 py-1 font-display text-[0.8rem] uppercase tracking-[0.16em] ${pill.cls}`}>
            {pill.label}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.24em] text-[#0A0A0A]/55">{item.brand}</p>
          {/* h2: the page's h1 sits directly above this list of items. The link's ::after makes the whole card clickable. */}
          <h2 className="mt-1 font-display text-[1.7rem] uppercase leading-none tracking-[0.02em] text-[#0A0A0A]">
            <Link href={href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0A0A0A]">
              {item.model}
            </Link>
          </h2>
          <p className="mt-1.5 truncate text-[0.9rem] font-bold text-[#0A0A0A]/60">{cur.colorway}</p>
        </div>

        {colours.length > 1 && (
          <div className="relative z-10 -mt-1" role="group" aria-label={`${colours.length} colours`}>
            <ul className="flex flex-wrap items-center gap-2">
              {shown.map((c, i) => (
                <li key={c.styleCode}>
                  <button
                    type="button"
                    aria-label={`${c.colorway}${c.bestAvailablePrice !== null ? `, ${formatInr(c.bestAvailablePrice)}` : ''}`}
                    aria-pressed={i === selected}
                    title={c.colorway}
                    onMouseEnter={() => setSelected(i)}
                    onFocus={() => setSelected(i)}
                    onClick={() => setSelected(i)}
                    className={`relative h-10 w-10 overflow-hidden rounded-xl bg-white transition-shadow ${i === selected ? 'ring-2 ring-[#0A0A0A]' : 'ring-1 ring-[#0A0A0A]/20 hover:ring-[#0A0A0A]/60'}`}
                  >
                    {c.primaryImageUrl ? (
                      <ShoePhoto key={c.primaryImageUrl} src={c.primaryImageUrl} alt="" className="h-full w-full object-contain p-0.5" fallback={<span className="block h-full w-full" style={{ background: paletteFor(c.colorway, item.brand).glow }} />} />
                    ) : (
                      <span className="block h-full w-full" style={{ background: paletteFor(c.colorway, item.brand).glow }} />
                    )}
                  </button>
                </li>
              ))}
              {extra > 0 && <li className="font-mono text-[0.78rem] font-bold text-[#0A0A0A]/55">+{extra}</li>}
            </ul>
            <p className="mt-1.5 font-mono text-[0.66rem] font-bold uppercase tracking-[0.14em] text-[#0A0A0A]/45">{colours.length} colours</p>
          </div>
        )}

        {(item.storeCount ?? 0) > 0 && selected === 0 && colours.length === 1 && (
          <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#0A0A0A]/45">
            {item.storeCount} {item.storeCount === 1 ? 'store' : 'stores'} to compare
          </p>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-[#0A0A0A]/10 pt-4">
          <div>
            <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[#0A0A0A]/50">Best price</p>
            {cur.bestAvailablePrice !== null ? (
              <p className="mt-1 font-mono text-[1.6rem] font-extrabold leading-none tabular-nums text-[#0A0A0A]">{formatInr(cur.bestAvailablePrice)}</p>
            ) : (
              <p className="mt-1 font-mono text-[0.9rem] font-bold text-[#0A0A0A]/50">Sold out</p>
            )}
          </div>
          <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0A0A0A] text-white transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>
      </div>

      <WishlistButton
        item={{
          styleCode: cur.styleCode,
          size: String(formatSize(cur.defaultSize)),
          brand: item.brand,
          model: item.model,
          colorway: cur.colorway,
          imageUrl,
          price: cur.bestAvailablePrice,
        }}
        className="absolute right-4 top-4 z-10"
      />
      <CompareToggle
        variant="icon"
        className="absolute right-4 top-[3.75rem] z-10"
        entry={{ styleCode: cur.styleCode, brand: item.brand, model: item.model, colorway: cur.colorway, imageUrl }}
      />
    </div>
  );
}

/** Skeleton twin of SneakerCard, for loading states. */
export function SneakerCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-[#0A0A0A]/10" aria-hidden>
      <div className="skeleton aspect-square" />
      <div className="flex flex-col gap-3 p-5">
        <div className="skeleton h-3 w-16" />
        <div className="skeleton h-6 w-2/3" />
        <div className="skeleton h-3 w-1/2" />
        <div className="skeleton mt-3 h-8 w-28" />
      </div>
    </div>
  );
}
