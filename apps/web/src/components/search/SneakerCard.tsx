'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SneakerArt } from '@/components/ui/SneakerArt';
import { BrandMark } from '@/components/ui/BrandMark';
import { fetchCatalogVariant, formatInr, formatSize, type SearchResultItem } from '@/lib/catalog';
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
  /** slug -> name and logo of every live store, to draw the stores' tiles. */
  stores?: Record<string, StoreInfo>;
}

interface Offer {
  slug: string;
  price: number;
  inStock: boolean;
  wasPrice: number | null;
}
interface SizeInfo {
  size: number;
  available: boolean;
}
interface ColourData {
  defaultSize: number;
  sizeList: SizeInfo[];
  offers: Offer[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const MAX_DOTS = 6;
const MAX_TILES = 5;

type Verdict = 'buy_now' | 'wait' | 'fair' | 'unclear';
const VERDICT_LOOK: Record<Verdict, { label: string; cls: string; tip: string }> = {
  buy_now: { label: 'Buy now', cls: 'bg-[#1F8A4C] text-white', tip: 'Good price to buy now for this size' },
  wait: { label: 'Wait', cls: 'bg-[#D97706] text-white', tip: 'Worth waiting: the price is above its usual level' },
  fair: { label: 'Fair price', cls: 'bg-[#14213D] text-white', tip: 'A fair price: no strong reason to rush or wait' },
  unclear: { label: 'Too early', cls: 'bg-[#0A0A0A]/10 text-[#0A0A0A]/60', tip: 'Not enough price history to call it yet' },
};

/**
 * One card per model, laid out as the CHOSN card design: the brand logo and a discount badge, the name, colour and best price (with the
 * store's "was" price when it lists one), the photo with arrows and dots, the colours, the sizes (sold-out ones crossed out), and a row
 * of tiles with each store's price for the chosen size. Pick a colour or a size and everything below follows. The whole card is one
 * link to the shoe; the colour, size and photo buttons sit above it.
 */
export function SneakerCard({ item, stores = {} }: SneakerCardProps) {
  // The API sends every matching colourway of the model, the shown one first; older / single results just have this one.
  const colours =
    item.colours && item.colours.length > 0
      ? item.colours
      : [{ styleCode: item.styleCode, colorway: item.colorway, primaryImageUrl: item.primaryImageUrl, defaultSize: item.defaultSize, bestAvailablePrice: item.bestAvailablePrice, sizes: [], storeSlugs: [], sizeList: [], offers: [] }];
  const [selected, setSelected] = useState(0);
  const [photo, setPhoto] = useState(0);
  const [pickedSize, setPickedSize] = useState<Record<string, number>>({});
  // Each colour's extra photos, its sizes/offers (when it was not sent with the list) and each size's offers load once, on demand.
  const [fetchedPhotos, setFetchedPhotos] = useState<Record<string, string[]>>({});
  const [fetchedColour, setFetchedColour] = useState<Record<string, ColourData>>({});
  const [sizeOffers, setSizeOffers] = useState<Record<string, Offer[]>>({});

  const cur = colours[Math.min(selected, colours.length - 1)] ?? colours[0]!;
  const sent: ColourData | null = cur.sizeList && cur.sizeList.length > 0 ? { defaultSize: Number(cur.defaultSize), sizeList: cur.sizeList, offers: cur.offers ?? [] } : null;
  const data = sent ?? fetchedColour[cur.styleCode] ?? null;
  const size = pickedSize[cur.styleCode] ?? data?.defaultSize ?? Number(cur.defaultSize);
  const offers: Offer[] | null = data ? (size === data.defaultSize ? data.offers : (sizeOffers[`${cur.styleCode}|${size}`] ?? null)) : null;

  const loadColour = useCallback(
    async (code: string) => {
      if (fetchedColour[code]) return;
      try {
        const res = await fetch(`${API_URL}/catalog/${encodeURIComponent(code)}/card`);
        if (!res.ok) return;
        const d = (await res.json()) as { defaultSize: number | null; sizeList: SizeInfo[]; offers: Offer[] };
        if (d.defaultSize !== null) setFetchedColour((f) => ({ ...f, [code]: { defaultSize: d.defaultSize as number, sizeList: d.sizeList, offers: d.offers } }));
      } catch {
        /* the card just keeps showing its basics */
      }
    },
    [fetchedColour],
  );
  const loadPhotos = useCallback(
    async (code: string) => {
      if (fetchedPhotos[code]) return fetchedPhotos[code];
      try {
        const res = await fetch(`${API_URL}/catalog/${encodeURIComponent(code)}/photos`);
        const list = res.ok ? ((await res.json()) as { photos: string[] }).photos : [];
        setFetchedPhotos((f) => ({ ...f, [code]: list }));
        return list;
      } catch {
        return [];
      }
    },
    [fetchedPhotos],
  );

  // A card that arrives without its sizes and store prices (the related-sneakers strip) loads them itself.
  const needsLoad = !sent && !fetchedColour[cur.styleCode];
  useEffect(() => {
    if (needsLoad) void loadColour(cur.styleCode);
  }, [needsLoad, cur.styleCode, loadColour]);

  const pickColour = (i: number) => {
    if (i === selected) return;
    setSelected(i);
    setPhoto(0);
    const c = colours[i];
    if (c && !(c.sizeList && c.sizeList.length > 0)) void loadColour(c.styleCode);
  };
  const pickSize = async (code: string, z: number) => {
    setPickedSize((p) => ({ ...p, [code]: z }));
    if (data && z === data.defaultSize) return;
    const key = `${code}|${z}`;
    if (sizeOffers[key]) return;
    try {
      const v = await fetchCatalogVariant(code, z);
      const list: Offer[] = (v?.offers ?? [])
        .filter((o) => o.mode !== 'fixture' && o.effectivePriceInr !== null)
        .map((o) => ({ slug: o.retailerSlug, price: Math.round(o.effectivePriceInr as number), inStock: o.inStock && !o.isStale, wasPrice: null }));
      setSizeOffers((s) => ({ ...s, [key]: list }));
    } catch {
      setSizeOffers((s) => ({ ...s, [key]: [] }));
    }
  };

  // Photos of the shown colour: the main one, then the other angles the stores gave. Until fetched, just the main one.
  const known = fetchedPhotos[cur.styleCode];
  const photos = [...new Set([cur.primaryImageUrl, ...(known ?? [])].filter((u): u is string => Boolean(u)))].slice(0, 6);
  const photoIdx = Math.min(photo, Math.max(photos.length - 1, 0));
  const step = (dir: 1 | -1) => async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const list = known ? photos : [...new Set([cur.primaryImageUrl, ...(await loadPhotos(cur.styleCode))].filter((u): u is string => Boolean(u)))].slice(0, 6);
    if (list.length > 1) setPhoto((photoIdx + dir + list.length) % list.length);
  };

  const live = (offers ?? []).filter((o) => o.inStock).sort((a, b) => a.price - b.price);
  const best = live[0] ?? null;
  const bestPrice = offers === null ? cur.bestAvailablePrice : (best?.price ?? null);
  // The store's own "was" price, only for the size the card opened on.
  const was = best && data && size === data.defaultSize ? best.wasPrice : null;
  const pct = was && best ? Math.round(((was - best.price) / was) * 100) : 0;
  // One tile per store: a store can list the same size twice (two product pages), so keep its best one (in stock first, then cheapest).
  const seenStore = new Set<string>();
  const tiles = [...(offers ?? [])]
    .sort((a, b) => Number(b.inStock) - Number(a.inStock) || a.price - b.price)
    .filter((o) => (seenStore.has(o.slug) ? false : (seenStore.add(o.slug), true)));
  const storeCount = live.length || (offers === null ? (cur.storeSlugs ?? []).length : 0);

  // Keep the chosen size in view in the card's size row (it opens on UK 3 otherwise, which matters once a size is picked above).
  const sizesRef = useRef<HTMLUListElement>(null);
  const sizeCount = data?.sizeList.length ?? 0;
  useEffect(() => {
    const ul = sizesRef.current;
    const el = ul?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!ul || !el) return;
    const e = el.getBoundingClientRect();
    const b = ul.getBoundingClientRect();
    ul.scrollLeft += e.left - b.left - b.width / 2 + e.width / 2;
  }, [size, cur.styleCode, sizeCount]);

  const href = `/sneakers/${encodeURIComponent(cur.styleCode)}/${formatSize(size)}`;
  const imageUrl = resolveSneakerImage(photos[photoIdx] ?? cur.primaryImageUrl);
  const palette = paletteFor(cur.colorway, item.brand);
  const shown = colours.slice(0, MAX_DOTS);
  const extra = colours.length - shown.length;
  const sizeList = data?.sizeList ?? [];
  const anyStock = offers === null ? bestPrice !== null : live.length > 0;
  // The Buy now / Wait verdict. The list sends it for the colour and size the card opened on; for any other colour or size it is fetched once.
  const [outlooks, setOutlooks] = useState<Record<string, Verdict | null>>({});
  const outlookKey = `${cur.styleCode}|${size}`;
  const opened = cur.styleCode === item.styleCode && size === Number(item.defaultSize);
  const verdict: Verdict | null | undefined = outlookKey in outlooks ? outlooks[outlookKey] : opened && item.outlook !== undefined ? item.outlook : undefined;
  useEffect(() => {
    if (verdict !== undefined) return;
    let alive = true;
    fetchCatalogVariant(cur.styleCode, size)
      .then((v) => alive && setOutlooks((o) => ({ ...o, [outlookKey]: (v?.outlook?.verdict as Verdict | undefined) ?? null })))
      .catch(() => alive && setOutlooks((o) => ({ ...o, [outlookKey]: null })));
    return () => {
      alive = false;
    };
  }, [outlookKey, verdict, cur.styleCode, size]);
  const verdictLook = verdict ? VERDICT_LOOK[verdict] : null;

  return (
    <div
      className="group relative flex h-full flex-col overflow-hidden rounded-[1.4rem] border border-[#0A0A0A]/10 bg-white transition-colors duration-300 hover:border-[#0A0A0A]"
      onMouseEnter={() => void loadPhotos(cur.styleCode)}
    >
      {/* One link over the whole card so a click anywhere opens the shoe. The colour, size and photo buttons and the wishlist/compare
          icons sit above it (z-10 / z-20). */}
      <Link href={href} aria-hidden tabIndex={-1} className="absolute inset-0 z-[5] rounded-[1.4rem]" />

      {/* Header: brand logo, discount badge, name, colour, price. */}
      <div className="relative z-10 px-2.5 pt-2.5 sm:px-3.5 sm:pt-3.5">
        <div className="flex items-start justify-between gap-3">
          <BrandMark brand={item.brand} className="!h-4 !max-w-[3.2rem] sm:!h-5 sm:!max-w-[4rem]" />
          {verdictLook && (
            <span title={verdictLook.tip} className={`rounded-full px-2 py-0.5 font-display text-[0.7rem] uppercase leading-none tracking-[0.03em] sm:px-2.5 sm:py-1 sm:text-[0.8rem] ${verdictLook.cls}`}>
              {verdictLook.label}
            </span>
          )}
          {!verdictLook && pct >= 1 && <span className="hidden rounded-full bg-[#FDE7E9] px-2.5 py-1 font-display text-[0.8rem] sm:inline-block uppercase leading-none tracking-[0.02em] text-[#D81E2D]">{pct}% off</span>}
        </div>
        <h2 className="mt-1 font-display text-[1rem] sm:mt-1.5 sm:text-[clamp(1.15rem,1.5vw,1.35rem)] uppercase leading-[0.98] tracking-[0.01em] text-[#0A0A0A]">
          <Link href={href} className="line-clamp-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0A0A0A]">
            {item.model}
          </Link>
        </h2>
        <p className="truncate text-[0.72rem] font-medium text-[#0A0A0A]/55">{cur.colorway}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {bestPrice !== null ? (
            <span className="font-sans text-[1rem] font-extrabold sm:text-[clamp(1.1rem,1.5vw,1.3rem)] leading-none tabular-nums text-[#0A0A0A]">{formatInr(bestPrice)}</span>
          ) : (
            <span className="text-[0.8rem] font-bold text-[#0A0A0A]/50 sm:text-[0.95rem]">Sold out in UK {formatSize(size)}</span>
          )}
          {was && <span className="text-[0.8rem] tabular-nums text-[#0A0A0A]/45 line-through">{formatInr(was)}</span>}
          {pct >= 1 && <span className="rounded-full bg-[#E3F5E7] px-2 py-0.5 text-[0.68rem] font-bold uppercase text-[#1B7A34]">{pct}% off</span>}
        </div>
      </div>

      {/* Photo with arrows and dots. */}
      <div className="relative aspect-[4/3] overflow-hidden bg-[#F4F5F7]">
        {imageUrl ? (
          // Plain <img>: no known remote domain to allow-list yet. Falls back to the illustration if the photo can't load.
          <ShoePhoto
            key={imageUrl}
            src={imageUrl}
            alt={`${item.brand} ${item.model} ${cur.colorway}`}
            className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-[1.06]"
            fallback={<SneakerArt colorway={cur.colorway} brand={item.brand} palette={palette} className="absolute inset-0 m-auto h-[80%] w-[88%]" />}
          />
        ) : (
          <SneakerArt colorway={cur.colorway} brand={item.brand} palette={palette} className="absolute inset-0 m-auto h-[80%] w-[88%]" />
        )}
        {(['prev', 'next'] as const).map((dir) => (
          <button
            key={dir}
            type="button"
            onClick={step(dir === 'next' ? 1 : -1)}
            disabled={known !== undefined && photos.length <= 1}
            aria-label={dir === 'next' ? 'Next photo' : 'Previous photo'}
            title={known !== undefined && photos.length <= 1 ? 'No more photos of this colour yet' : dir === 'next' ? 'Next photo' : 'Previous photo'}
            className={`absolute top-1/2 z-20 flex h-7 w-7 -translate-y-1/2 items-center before:absolute before:-inset-2 before:content-['']  justify-center rounded-full bg-white text-[#0A0A0A] opacity-70 shadow-[0_2px_10px_rgba(10,10,10,0.12)] ring-1 ring-[#0A0A0A]/5 transition duration-200 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A0A0A] group-hover:opacity-100 disabled:cursor-default disabled:opacity-25 ${dir === 'next' ? 'right-2.5' : 'left-2.5'}`}
          >
            {dir === 'next' ? <ChevronRight className="h-4 w-4" strokeWidth={2.25} aria-hidden /> : <ChevronLeft className="h-4 w-4" strokeWidth={2.25} aria-hidden />}
          </button>
        ))}
        {photos.length > 1 && (
          <span className="pointer-events-none absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1" aria-hidden>
            {photos.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all duration-200 ${i === photoIdx ? 'w-3 bg-[#0A0A0A]' : 'w-1.5 bg-[#0A0A0A]/18'}`} />
            ))}
          </span>
        )}
        <WishlistButton
          item={{ styleCode: cur.styleCode, size: String(formatSize(size)), brand: item.brand, model: item.model, colorway: cur.colorway, imageUrl, price: bestPrice }}
          className="absolute bottom-2 right-2 z-20"
        />
        <CompareToggle
          variant="icon"
          className="absolute bottom-2 right-[3.2rem] z-20"
          entry={{ styleCode: cur.styleCode, brand: item.brand, model: item.model, colorway: cur.colorway, imageUrl }}
        />
      </div>

      <div className="flex flex-1 flex-col gap-1.5 px-2.5 pb-2.5 pt-1 sm:gap-2 sm:px-3.5 sm:pb-3">
        {/* Colours. */}
        {colours.length > 1 && (
          <div className="relative z-10 flex items-center gap-2" role="group" aria-label={`${colours.length} colours`}>
            <ul className="flex items-center gap-1.5">
              {shown.map((c, i) => (
                <li key={c.styleCode}>
                  <button
                    type="button"
                    aria-label={`${c.colorway}${c.bestAvailablePrice !== null ? `, ${formatInr(c.bestAvailablePrice)}` : ''}`}
                    aria-pressed={i === selected}
                    title={c.colorway}
                    onMouseEnter={() => pickColour(i)}
                    onFocus={() => pickColour(i)}
                    onClick={() => pickColour(i)}
                    className={`relative h-6 w-6 rounded-md bg-[#F3F5F8] transition-shadow before:absolute before:-inset-x-[3px] before:-inset-y-2.5 before:content-[''] ${i === selected ? 'ring-2 ring-[#0A0A0A]' : 'ring-1 ring-[#0A0A0A]/15 hover:ring-[#0A0A0A]/50'}`}
                  >
                    <span className="block h-full w-full overflow-hidden rounded-md">
                    {c.primaryImageUrl ? (
                      <ShoePhoto key={c.primaryImageUrl} src={c.primaryImageUrl} alt="" className="h-full w-full object-contain p-0.5" fallback={<span className="block h-full w-full" style={{ background: paletteFor(c.colorway, item.brand).glow }} />} />
                    ) : (
                      <span className="block h-full w-full" style={{ background: paletteFor(c.colorway, item.brand).glow }} />
                    )}
                    </span>
                  </button>
                </li>
              ))}
              {extra > 0 && <li className="font-mono text-[0.72rem] font-bold text-[#0A0A0A]/50">+{extra}</li>}
            </ul>
            <span className="ml-auto hidden font-mono text-[0.64rem] font-bold uppercase tracking-[0.12em] text-[#0A0A0A]/40 sm:inline">{colours.length} colours</span>
          </div>
        )}

        {/* Available sizes: sold-out ones are crossed out. */}
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-[0.7rem] font-bold text-[#0A0A0A] sm:text-[0.78rem]">Sizes</h3>
            <span className={`flex items-center gap-1.5 text-[0.68rem] font-semibold ${anyStock ? 'text-[#0A0A0A]/65' : 'text-[#0A0A0A]/40'}`}>
              <span className={`h-2 w-2 rounded-full ${anyStock ? 'bg-[#1FA34A]' : 'bg-[#0A0A0A]/25'}`} aria-hidden />
              {anyStock ? 'In Stock' : 'Sold out'}
            </span>
          </div>
          {sizeList.length > 0 ? (
            <ul ref={sizesRef} className="relative z-10 -mb-2.5 mt-[-0.375rem] flex gap-1 overflow-x-auto pb-3 pt-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="UK sizes">
              {sizeList.map((s, idx) => {
                const active = s.size === size;
                return (
                  <li key={s.size} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => void pickSize(cur.styleCode, s.size)}
                      aria-pressed={active}
                      aria-label={`UK ${formatSize(s.size)}${s.available ? '' : ', sold out everywhere'}`}
                      title={s.available ? undefined : 'Sold out at every store we compare'}
                      className={`relative flex h-6 min-w-[1.9rem] items-center justify-center rounded-md border px-1.5 text-[0.72rem] font-semibold tabular-nums transition-colors before:absolute before:-inset-x-0.5 before:-inset-y-2.5 before:content-[''] ${
                        active
                          ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white'
                          : s.available
                            ? 'border-[#0A0A0A]/12 bg-white text-[#0A0A0A] hover:border-[#0A0A0A]/50'
                            : 'border-[#0A0A0A]/8 bg-[#0A0A0A]/[0.03] text-[#0A0A0A]/30 after:pointer-events-none after:absolute after:inset-x-1.5 after:top-1/2 after:h-px after:-rotate-[22deg] after:bg-[#0A0A0A]/35 after:content-[\'\']'
                      }`}
                    >
                      {idx === 0 ? `UK ${formatSize(s.size)}` : formatSize(s.size)}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2.5 text-[0.85rem] text-[#0A0A0A]/45">{data === null ? 'Loading sizes…' : 'No sizes listed'}</p>
          )}
        </div>

        {/* Phones: just the store count; the price tiles take too much room there. */}
        <p className="mt-auto text-[0.7rem] font-semibold text-[#0A0A0A]/55 sm:hidden">
          {storeCount} {storeCount === 1 ? 'store' : 'stores'} compared
        </p>

        {/* Compare prices: one tile per store for the chosen size. */}
        <div className="mt-auto hidden sm:block">
          <div className="flex items-center justify-between">
            <h3 className="text-[0.78rem] font-bold text-[#0A0A0A]">Compare Prices</h3>
            <span className="text-[0.68rem] text-[#0A0A0A]/45">
              {storeCount} {storeCount === 1 ? 'Store' : 'Stores'}
            </span>
          </div>
          {tiles.length > 0 ? (
            <ul className="relative z-10 mt-1 grid grid-flow-col auto-cols-[minmax(4rem,1fr)] gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {tiles.slice(0, MAX_TILES + 3).map((o) => {
                const st = stores[o.slug];
                const lowest = best !== null && o.slug === best.slug && o.inStock;
                return (
                  <li
                    key={o.slug}
                    title={st?.name ?? o.slug}
                    className={`flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-center ${lowest ? 'border-[#8FD6A2] bg-[#E9F8EE]' : 'border-[#0A0A0A]/10 bg-white'} ${o.inStock ? '' : 'opacity-60'}`}
                  >
                    <span className="flex h-4 items-center justify-center">
                      {st?.logoUrl ? (
                        <img src={st.logoUrl} alt={st.name} className="max-h-4 max-w-[3.2rem] object-contain" loading="lazy" />
                      ) : (
                        <span className="max-w-[3.4rem] truncate text-[0.6rem] font-bold text-[#0A0A0A]/70">{st?.name ?? o.slug}</span>
                      )}
                    </span>
                    <span className={`text-[0.76rem] font-extrabold tabular-nums ${o.inStock ? 'text-[#0A0A0A]' : 'text-[#0A0A0A]/40 line-through'}`}>{formatInr(o.price)}</span>
                    <span
                      className={`rounded-full px-1.5 py-px text-[0.56rem] font-semibold ${
                        lowest ? 'bg-[#C9EDD3] text-[#1B7A34]' : o.inStock ? 'bg-[#0A0A0A]/[0.06] text-[#0A0A0A]/55' : 'bg-[#0A0A0A]/[0.06] text-[#0A0A0A]/45'
                      }`}
                    >
                      {lowest ? 'Lowest' : o.inStock ? 'In Stock' : 'Sold out'}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2.5 text-[0.85rem] text-[#0A0A0A]/45">{offers === null ? (data === null ? 'Loading prices…' : 'Loading prices for this size…') : 'No store lists this size right now.'}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Skeleton twin of SneakerCard, for loading states. */
export function SneakerCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-[#0A0A0A]/10 p-5" aria-hidden>
      <div className="skeleton h-9 w-24" />
      <div className="skeleton mt-4 h-9 w-2/3" />
      <div className="skeleton mt-3 h-8 w-32" />
      <div className="skeleton mt-4 aspect-[4/3]" />
      <div className="skeleton mt-4 h-11 w-full" />
      <div className="skeleton mt-4 h-24 w-full" />
    </div>
  );
}
