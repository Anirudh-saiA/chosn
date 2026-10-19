'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SneakerArt } from '@/components/ui/SneakerArt';
import { BrandMark } from '@/components/ui/BrandMark';
import { formatInr, formatSize, type SearchResultItem } from '@/lib/catalog';
import { paletteFor } from '@/lib/sneaker/palette';
import { resolveSneakerImage } from '@/lib/resolve-sneaker-image';
import { ShoePhoto } from '@/components/ui/ShoePhoto';
import { WishlistButton } from '@/components/wishlist/WishlistButton';
import { CompareToggle } from '@/components/compare/CompareToggle';

export interface StoreInfo {
  name: string;
  logoUrl: string | null;
}

export interface SneakerCardProps {
  item: SearchResultItem;
  /** slug -> name and logo of every live store, to draw the logos of the stores that have this shoe. */
  stores?: Record<string, StoreInfo>;
}

const SIGNAL_PILL: Partial<Record<NonNullable<SearchResultItem['signal']>, { label: string; cls: string }>> = {
  good_time_to_buy: { label: 'Buy', cls: 'bg-[#0A0A0A] text-white' },
  consider_waiting: { label: 'Wait', cls: 'bg-[#FF7A1A] text-[#0A0A0A]' },
};

const MAX_DOTS = 6;
const MAX_SIZES = 8;
const MAX_LOGOS = 6;

/**
 * One compact card per model. The photo frame carries the name, colour and best price top-left and the brand's logo in a notch
 * top-right, with arrows and dots to flip the colour's photos. Under it: the other colours, the UK sizes in stock, and the logos of
 * the stores that have this shoe. Hover or tap a colour and everything switches to it. The whole card is one link (a stretched link
 * on the name); the buttons sit above it.
 */
export function SneakerCard({ item, stores = {} }: SneakerCardProps) {
  // The API sends every matching colourway of the model, the shown one first; older / single results just have this one.
  const colours =
    item.colours && item.colours.length > 0
      ? item.colours
      : [{ styleCode: item.styleCode, colorway: item.colorway, primaryImageUrl: item.primaryImageUrl, defaultSize: item.defaultSize, bestAvailablePrice: item.bestAvailablePrice, sizes: [], storeSlugs: [] }];
  const [selected, setSelected] = useState(0);
  const [photo, setPhoto] = useState(0);
  // Each colour's extra photos are fetched once, the first time the card is hovered or a photo button is used.
  const [fetched, setFetched] = useState<Record<string, string[]>>({});
  const cur = colours[Math.min(selected, colours.length - 1)] ?? colours[0]!;
  // Changing colour starts that colour's photos again from the first one.
  const pick = (i: number) => {
    if (i === selected) return;
    setSelected(i);
    setPhoto(0);
  };
  const loadPhotos = useCallback(
    async (code: string) => {
      if (fetched[code]) return fetched[code];
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/catalog/${encodeURIComponent(code)}/photos`);
        const list = res.ok ? ((await res.json()) as { photos: string[] }).photos : [];
        setFetched((f) => ({ ...f, [code]: list }));
        return list;
      } catch {
        return [];
      }
    },
    [fetched],
  );
  // The photos of the shown colour: the main one, then the other angles the stores gave. Until they are fetched, just the main one.
  const known = fetched[cur.styleCode];
  const photos = [...new Set([cur.primaryImageUrl, ...(known ?? [])].filter((u): u is string => Boolean(u)))].slice(0, 6);
  const photoIdx = Math.min(photo, Math.max(photos.length - 1, 0));
  const step = (dir: 1 | -1) => async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const list = known ? photos : [...new Set([cur.primaryImageUrl, ...(await loadPhotos(cur.styleCode))].filter((u): u is string => Boolean(u)))].slice(0, 6);
    if (list.length > 1) setPhoto((photoIdx + dir + list.length) % list.length);
  };

  const href = `/sneakers/${encodeURIComponent(cur.styleCode)}/${formatSize(cur.defaultSize)}`;
  const pill = selected === 0 && item.signal ? SIGNAL_PILL[item.signal] : undefined;
  const imageUrl = resolveSneakerImage(photos[photoIdx] ?? cur.primaryImageUrl);
  const palette = paletteFor(cur.colorway, item.brand);
  const shown = colours.slice(0, MAX_DOTS);
  const extra = colours.length - shown.length;
  const sizes = cur.sizes ?? [];
  const slugs = cur.storeSlugs ?? [];

  return (
    <div
      className="group relative flex h-full flex-col overflow-hidden rounded-[1.6rem] border border-[#0A0A0A]/10 bg-white p-1.5 transition-colors duration-300 hover:border-[#0A0A0A]"
      onMouseEnter={() => void loadPhotos(cur.styleCode)}
    >
      {/* One link over the whole card (photo, name, sizes, logos) so a click anywhere opens the shoe. The colour buttons, photo arrows and
          the wishlist/compare icons sit above it (z-10 / z-20). */}
      <Link href={href} aria-hidden tabIndex={-1} className="absolute inset-0 z-[5] rounded-[1.6rem]" />
      <div
        className={`relative aspect-[7/8] overflow-hidden rounded-[1.2rem] ${imageUrl ? 'bg-[#F3F5F8]' : ''}`}
        style={imageUrl ? undefined : { background: `linear-gradient(160deg, ${palette.glow}40, ${palette.glow}14)` }}
      >
        {imageUrl ? (
          // Plain <img>: no known remote domain to allow-list yet. Falls back to the illustration if the photo can't load.
          <ShoePhoto
            key={imageUrl}
            src={imageUrl}
            alt={`${item.brand} ${item.model} ${cur.colorway}`}
            className="absolute inset-0 h-full w-full object-contain p-6 pt-24 transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            fallback={<SneakerArt colorway={cur.colorway} brand={item.brand} palette={palette} className="absolute inset-0 m-auto h-[70%] w-[88%]" />}
          />
        ) : (
          <SneakerArt colorway={cur.colorway} brand={item.brand} palette={palette} className="absolute inset-0 m-auto h-[70%] w-[88%] translate-y-6" />
        )}

        {/* Name, colour and best price, top-left. h2: the page's h1 sits directly above. The link's ::after makes the whole card clickable. */}
        <div className="absolute left-0 top-0 z-10 max-w-[68%] p-3.5">
          <h2 className="font-display text-[1.2rem] uppercase leading-[1.05] tracking-[0.02em] text-[#0A0A0A]">
            <Link href={href} className="line-clamp-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0A0A0A]">
              {item.model}
            </Link>
          </h2>
          <p className="mt-1 truncate text-[0.74rem] font-semibold text-[#0A0A0A]/55">{cur.colorway}</p>
          <span className="mt-2 inline-flex rounded-full bg-[#0A0A0A] px-3 py-1 font-mono text-[0.82rem] font-bold tabular-nums text-white">
            {cur.bestAvailablePrice !== null ? formatInr(cur.bestAvailablePrice) : 'Sold out'}
          </span>
        </div>

        {/* The brand's logo in a white notch, top-right. */}
        <div className="absolute right-0 top-0 z-10 flex h-11 min-w-[4.5rem] items-center justify-center rounded-bl-[1.1rem] bg-white px-3.5">
          <BrandMark brand={item.brand} />
        </div>

        {pill && (
          <span className={`absolute bottom-3 left-3 z-10 rounded-full px-2.5 py-0.5 font-display text-[0.7rem] uppercase tracking-[0.14em] ${pill.cls}`}>{pill.label}</span>
        )}

        {/* Two buttons on every card: flip through this colour's photos. They sit above the card's link, so they do not open the shoe. */}
        {(['prev', 'next'] as const).map((dir) => (
          <button
            key={dir}
            type="button"
            onClick={step(dir === 'next' ? 1 : -1)}
            disabled={known !== undefined && photos.length <= 1}
            aria-label={dir === 'next' ? 'Next photo' : 'Previous photo'}
            title={known !== undefined && photos.length <= 1 ? 'No more photos of this colour yet' : dir === 'next' ? 'Next photo' : 'Previous photo'}
            className={`absolute top-[58%] z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-[#0A0A0A]/70 opacity-60 ring-1 ring-[#0A0A0A]/10 backdrop-blur-sm transition duration-200 hover:bg-white hover:text-[#0A0A0A] hover:ring-[#0A0A0A]/30 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A0A0A] group-hover:opacity-100 disabled:cursor-default disabled:opacity-20 disabled:hover:bg-white/85 disabled:hover:ring-[#0A0A0A]/10 ${dir === 'next' ? 'right-2.5' : 'left-2.5'}`}
          >
            {dir === 'next' ? <ChevronRight className="h-4 w-4" strokeWidth={2.25} aria-hidden /> : <ChevronLeft className="h-4 w-4" strokeWidth={2.25} aria-hidden />}
          </button>
        ))}
        {photos.length > 1 && (
          <span className="pointer-events-none absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1" aria-hidden>
            {photos.map((_, i) => (
              <span key={i} className={`h-1 rounded-full transition-all duration-200 ${i === photoIdx ? 'w-3.5 bg-[#0A0A0A]/80' : 'w-1 bg-[#0A0A0A]/20'}`} />
            ))}
          </span>
        )}

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
          className="absolute bottom-2.5 right-2.5 z-20"
        />
        <CompareToggle
          variant="icon"
          className="absolute bottom-2.5 right-[3.4rem] z-20"
          entry={{ styleCode: cur.styleCode, brand: item.brand, model: item.model, colorway: cur.colorway, imageUrl }}
        />
      </div>

      <div className="flex flex-1 flex-col gap-2.5 px-2.5 pb-2.5 pt-3">
        {colours.length > 1 && (
          <div className="relative z-10 flex items-center gap-1.5" role="group" aria-label={`${colours.length} colours`}>
            <ul className="flex items-center gap-1.5">
              {shown.map((c, i) => (
                <li key={c.styleCode}>
                  <button
                    type="button"
                    aria-label={`${c.colorway}${c.bestAvailablePrice !== null ? `, ${formatInr(c.bestAvailablePrice)}` : ''}`}
                    aria-pressed={i === selected}
                    title={c.colorway}
                    onMouseEnter={() => pick(i)}
                    onFocus={() => pick(i)}
                    onClick={() => pick(i)}
                    className={`relative h-8 w-8 overflow-hidden rounded-lg bg-[#F3F5F8] transition-shadow ${i === selected ? 'ring-2 ring-[#0A0A0A]' : 'ring-1 ring-[#0A0A0A]/15 hover:ring-[#0A0A0A]/50'}`}
                  >
                    {c.primaryImageUrl ? (
                      <ShoePhoto key={c.primaryImageUrl} src={c.primaryImageUrl} alt="" className="h-full w-full object-contain p-0.5" fallback={<span className="block h-full w-full" style={{ background: paletteFor(c.colorway, item.brand).glow }} />} />
                    ) : (
                      <span className="block h-full w-full" style={{ background: paletteFor(c.colorway, item.brand).glow }} />
                    )}
                  </button>
                </li>
              ))}
              {extra > 0 && <li className="font-mono text-[0.7rem] font-bold text-[#0A0A0A]/50">+{extra}</li>}
            </ul>
            <span className="ml-auto font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[#0A0A0A]/40">{colours.length} colours</span>
          </div>
        )}

        {/* UK sizes in stock for the shown colour. */}
        <div className="flex flex-wrap items-center gap-1" aria-label="Sizes in stock">
          {sizes.length > 0 ? (
            <>
              <span className="mr-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-[0.14em] text-[#0A0A0A]/40">UK</span>
              {sizes.slice(0, MAX_SIZES).map((s) => (
                <span key={s} className="rounded-md border border-[#0A0A0A]/12 px-1.5 py-0.5 font-mono text-[0.68rem] font-semibold tabular-nums text-[#0A0A0A]/75">
                  {formatSize(s)}
                </span>
              ))}
              {sizes.length > MAX_SIZES && <span className="font-mono text-[0.68rem] font-bold text-[#0A0A0A]/45">+{sizes.length - MAX_SIZES}</span>}
            </>
          ) : (
            <span className="text-[0.74rem] font-semibold text-[#0A0A0A]/45">Sold out in every size</span>
          )}
        </div>

        {/* Logos of the stores that have this shoe in stock. */}
        {slugs.length > 0 && (
          <div className="mt-auto flex items-center gap-1.5 border-t border-[#0A0A0A]/8 pt-2.5" aria-label={`In stock at ${slugs.length} ${slugs.length === 1 ? 'store' : 'stores'}`}>
            <ul className="flex items-center -space-x-1.5">
              {slugs.slice(0, MAX_LOGOS).map((slug) => {
                const st = stores[slug];
                return (
                  <li
                    key={slug}
                    title={st?.name ?? slug}
                    className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-[#0A0A0A]/15"
                  >
                    {st?.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={st.logoUrl} alt={st.name} className="h-4 w-4 object-contain" loading="lazy" />
                    ) : (
                      <span className="font-mono text-[0.6rem] font-bold text-[#0A0A0A]/60">{(st?.name ?? slug).charAt(0)}</span>
                    )}
                  </li>
                );
              })}
            </ul>
            {slugs.length > MAX_LOGOS && <span className="font-mono text-[0.68rem] font-bold text-[#0A0A0A]/45">+{slugs.length - MAX_LOGOS}</span>}
            <span className="ml-auto font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[#0A0A0A]/40">
              {slugs.length === 1 ? `Only at ${stores[slugs[0]!]?.name ?? 'one store'}` : `${slugs.length} stores`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Skeleton twin of SneakerCard, for loading states. */
export function SneakerCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[1.6rem] border border-[#0A0A0A]/10 p-1.5" aria-hidden>
      <div className="skeleton aspect-[7/8] rounded-[1.2rem]" />
      <div className="flex flex-col gap-2.5 px-2.5 pb-2.5 pt-3">
        <div className="skeleton h-6 w-1/2" />
        <div className="skeleton h-5 w-2/3" />
        <div className="skeleton h-6 w-full" />
      </div>
    </div>
  );
}
