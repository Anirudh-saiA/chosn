import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ScrollHighlight } from './ScrollHighlight';
import { ScrollOn } from './ScrollOn';
import { Marquee } from '@/components/fx/Marquee';
import { Reveal } from '@/components/fx/Reveal';
import { fetchCatalogVariant, fetchSearch, formatInr, formatSize, type CatalogOffer, type CatalogResponse } from '@/lib/catalog';
import { deliveryDays, formatDelivery, isEligible } from '@/lib/recommend';
import { resolveSneakerImage } from '@/lib/resolve-sneaker-image';

/** The retailers CHOSN reads prices from (mirrors SourcesStrip). */
const RETAILERS = [
  { name: 'Superkicks', logo: '/stores/superkicks.png' },
  { name: 'Crepdog Crew', logo: '/stores/crepdog-crew.png' },
  { name: 'VegNonVeg', logo: '/stores/vegnonveg.png' },
  { name: 'Mainstreet Marketplace', logo: '/stores/mainstreet-marketplace.png' },
  { name: 'Myntra', logo: '/stores/myntra.png' },
  { name: 'Limited Edt', logo: '/stores/limited-edt.png' },
  { name: 'Puma India', logo: '/stores/puma-india.png' },
  { name: 'Gully Labs', logo: '/stores/gully-labs.png' },
  { name: 'Culture Circle', logo: '/stores/culture-circle.png' },
];

const hand = 'font-[family-name:var(--font-hand)] font-bold';
const REVALIDATE = { next: { revalidate: 600 } } as const;

/** A wobbly hand-drawn arrow (double-headed), drawn as SVG so it reads like a pen doodle. */
function DoodleArrow({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 40" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path pathLength={1} className="doodle-draw" d="M12 22 C 40 10, 62 34, 92 20 S 150 12, 186 21" />
      <path pathLength={1} className="doodle-draw" style={{ transitionDelay: '0.5s' }} d="M26 10 L 10 22 L 28 33" />
      <path pathLength={1} className="doodle-draw" style={{ transitionDelay: '0.7s' }} d="M172 9 L 189 21 L 171 32" />
    </svg>
  );
}

/** A loose hand-drawn ring to circle the better number. */
function DoodleRing() {
  return (
    <svg viewBox="0 0 220 80" fill="none" stroke="#E0740F" strokeWidth="3" strokeLinecap="round" aria-hidden className="pointer-events-none absolute -inset-x-3 -inset-y-2 h-[calc(100%+1rem)] w-[calc(100%+1.5rem)]" preserveAspectRatio="none">
      <path pathLength={1} className="doodle-ring" d="M30 14 C 90 -2, 190 4, 208 36 C 218 62, 120 78, 50 70 C 6 64, -4 30, 34 16 C 60 8, 90 8, 110 10" />
    </svg>
  );
}

function Cell({ site, label, value, sub, best }: { site: string; label: string; value: string; sub?: string; best?: boolean }) {
  return (
    <ScrollOn className="rounded-2xl border border-[#0A0A0A]/10 bg-white/80 px-6 py-5 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.35)] backdrop-blur cmp-cell">
      <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.22em] text-[#0A0A0A]/50">
        <span className="md:hidden">{site} · </span>
        {label}
      </p>
      <p className="relative mt-1 inline-block font-mono text-[1.9rem] font-extrabold leading-tight text-[#0A0A0A]">
        {best && <DoodleRing />}
        <span className={`cmp-num ${best ? 'cmp-num-best' : 'cmp-num-dim'}`}>{value}</span>
      </p>
      {sub && <p className="cmp-sub mt-1 text-[0.85rem] font-bold text-text-soft">{sub}</p>}
    </ScrollOn>
  );
}

function Note({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <ScrollOn delay={250} className={`flex flex-col items-center justify-center text-center text-[#E0740F] ${className}`}>
      <p className={`${hand} cmp-note text-[1.7rem] leading-none`}>{children}</p>
      <DoodleArrow className="mt-1 h-8 w-40 max-w-full" />
    </ScrollOn>
  );
}

function Header({ offer }: { offer: CatalogOffer }) {
  return (
    <div className="hidden items-center justify-center gap-3 rounded-2xl bg-[#14213D] px-6 py-4 text-center font-display text-[1.7rem] uppercase tracking-[0.02em] text-white md:flex">
      {offer.retailerLogoUrl && (
        <span className="flex h-9 w-14 items-center justify-center rounded-lg bg-white px-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={offer.retailerLogoUrl} alt="" className="max-h-7 max-w-full object-contain" />
        </span>
      )}
      {offer.retailerName}
    </div>
  );
}

interface Example {
  data: CatalogResponse;
  a: CatalogOffer; // the cheapest in-stock store
  b: CatalogOffer; // the store to compare it with
}

/** The returns rule as a short label, from the store's own stated policy (nothing is scored or invented). */
function returnsLabel(o: CatalogOffer): string {
  if (o.returnsTone === 'ok') return 'Returns accepted';
  if (o.returnsTone === 'limited') return 'Limited returns';
  if (o.returnsTone === 'none') return 'No returns';
  return 'Not stated';
}
const toneRank = (o: CatalogOffer) => (o.returnsTone === 'ok' ? 2 : o.returnsTone === 'limited' ? 1 : 0);
const short = (t: string | null, n = 70) => (t ? (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t) : undefined);

/**
 * A real comparison for the landing page: the most-compared shoe that two stores have in stock right now, its real prices and each
 * store's own delivery estimate and returns rule. Nothing here is illustrative; if no such shoe can be found the example is left out.
 */
async function loadExample(): Promise<Example | null> {
  try {
    const found = await fetchSearch({}, REVALIDATE);
    for (const r of found.results.slice(0, 12)) {
      const c = r.colours?.[0];
      if (!c || !r.primaryImageUrl) continue;
      const live = (c.offers ?? []).filter((o) => o.inStock);
      if (live.length < 2) continue;
      const data = await fetchCatalogVariant(c.styleCode, Number(c.defaultSize), REVALIDATE);
      if (!data) continue;
      const pool = data.offers.filter(isEligible).sort((x, y) => (x.effectivePriceInr as number) - (y.effectivePriceInr as number));
      if (pool.length < 2) continue;
      const a = pool[0]!;
      const others = pool.slice(1);
      // The other store: the one with the quickest stated delivery; if none states one, the next cheapest.
      const withDays = others.filter((o) => deliveryDays(o) !== null);
      const b = withDays.length > 0 ? withDays.reduce((p, q) => ((deliveryDays(q) as number) < (deliveryDays(p) as number) ? q : p)) : others[0]!;
      if ((b.effectivePriceInr as number) <= (a.effectivePriceInr as number)) continue;
      return { data, a, b };
    }
  } catch {
    /* no example rather than a made-up one */
  }
  return null;
}

const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export async function CompareExample() {
  const ex = await loadExample();
  const header = (
    <>
      <Reveal>
        <h2 className="sr-only">Compare</h2>
        <div className="mb-12 flex flex-wrap items-start justify-between gap-8 border-b-2 border-[#0A0A0A] pb-8">
          <ScrollHighlight />

          <div className="flex flex-col items-end gap-4">
            <Link
              href="/sneakers"
              className="inline-flex items-center gap-2 rounded-full bg-[#0A0A0A] px-7 py-3.5 font-display text-[1.05rem] uppercase tracking-[0.18em] text-white shadow-[0_14px_30px_-12px_rgba(0,0,0,0.6)] transition-colors hover:bg-[#262626]"
            >
              Compare <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </Reveal>

      {/* live-scrolling band of the retailers we compare */}
      <div className="glass-frost mb-14 overflow-hidden rounded-full py-4" aria-label="Retailers we compare">
        <Marquee duration={30} repeat={2}>
          <span className="mx-6 shrink-0 rounded-full bg-text px-3.5 py-1.5 font-mono text-[0.62rem] font-extrabold uppercase tracking-[0.22em] text-[#F4F1EA]">Retailers</span>
          {RETAILERS.map((r) => (
            <span key={r.name} className="flex shrink-0 items-center">
              <span className="flex items-center gap-3.5 px-8">
                <img src={r.logo} alt="" className="h-9 w-auto max-w-[6rem] object-contain" loading="lazy" draggable={false} />
                <span className="font-display text-[clamp(1.6rem,3vw,2.4rem)] font-bold leading-none tracking-tight text-text">{r.name}</span>
              </span>
              <span aria-hidden className="h-1.5 w-1.5 rotate-45 bg-brass" />
            </span>
          ))}
        </Marquee>
      </div>
    </>
  );

  if (!ex) {
    return (
      <section id="compare" data-ambient="dunk" className="mx-auto w-full max-w-[90rem] px-5 pb-20 pt-10 sm:px-8">
        {header}
      </section>
    );
  }

  const { data, a, b } = ex;
  const size = formatSize(data.variant.size);
  const priceA = a.effectivePriceInr as number;
  const priceB = b.effectivePriceInr as number;
  const daysA = deliveryDays(a);
  const daysB = deliveryDays(b);
  const bothDays = daysA !== null && daysB !== null && daysA !== daysB;
  const fasterIsA = bothDays && (daysA as number) < (daysB as number);
  const fasterIsB = bothDays && (daysB as number) < (daysA as number);
  const dayGap = bothDays ? Math.round(Math.abs((daysA as number) - (daysB as number))) : 0;
  const tonesDiffer = toneRank(a) !== toneRank(b);
  const readOn = [a.fetchedAt, b.fetchedAt].sort().slice(-1)[0] ?? a.fetchedAt;
  const name = `${data.sneaker.brand} ${data.sneaker.model}`;
  const image = resolveSneakerImage(data.sneaker.primaryImageUrl);

  return (
    <section id="compare" data-ambient="dunk" className="mx-auto w-full max-w-[90rem] px-5 pb-20 pt-10 sm:px-8">
      {header}
      <Reveal>
        <div className="mb-6 flex flex-col items-center">
          {image && (
            // The photo's white square fades into the page (a soft oval mask), and the shoe is zoomed in so it is the hero of the section.
            <div className="relative aspect-[16/9] w-[min(44rem,96vw)] overflow-hidden [mask-image:radial-gradient(ellipse_closest-side,#000_62%,transparent_100%)] [-webkit-mask-image:radial-gradient(ellipse_closest-side,#000_62%,transparent_100%)]">
              <img
                src={image}
                alt={`${name} ${data.sneaker.colorway}`}
                loading="lazy"
                decoding="async"
                draggable={false}
                className="absolute inset-0 h-full w-full scale-[1.9] select-none object-contain"
              />
            </div>
          )}
          <Link href={`/sneakers/${encodeURIComponent(data.sneaker.styleCode)}/${size}`} className="mt-2 text-center font-display text-[1.25rem] uppercase tracking-[0.02em] text-[#0A0A0A] hover:underline">
            {name} · UK {size}
          </Link>
          <p className="mt-1 font-mono text-[0.6rem] font-bold uppercase tracking-[0.22em] text-[#0A0A0A]/45">Real prices from our data · read {day(readOn)}</p>
        </div>

        {/* [store A] [what differs] [store B] — one row per thing worth comparing */}
        <div className="grid items-stretch gap-x-4 gap-y-3 md:grid-cols-[1fr_minmax(11rem,15rem)_1fr]">
          <Header offer={a} />
          <div className="hidden md:block" />
          <Header offer={b} />

          <Cell site={a.retailerName} label="Price" value={formatInr(priceA)} best sub="Cheapest listing" />
          <Note>{formatInr(priceB - priceA)} cheaper</Note>
          <Cell site={b.retailerName} label="Price" value={formatInr(priceB)} sub={`${formatInr(priceB - priceA)} more`} />

          <Cell site={a.retailerName} label="Delivery" value={formatDelivery(a) ?? 'Not stated'} best={fasterIsA} sub={a.shippingNote ? short(a.shippingNote, 46) : "The store's own estimate"} />
          <Note>{bothDays ? `${dayGap} ${dayGap === 1 ? 'day' : 'days'} faster${fasterIsB ? ' →' : ''}` : 'Check each store'}</Note>
          <Cell site={b.retailerName} label="Delivery" value={formatDelivery(b) ?? 'Not stated'} best={fasterIsB} sub={b.shippingNote ? short(b.shippingNote, 46) : "The store's own estimate"} />

          <Cell site={a.retailerName} label="Returns" value={returnsLabel(a)} best={tonesDiffer && toneRank(a) > toneRank(b)} sub={short(a.returnsNote)} />
          <Note>{tonesDiffer ? 'Different return rules' : 'Read each store’s terms'}</Note>
          <Cell site={b.retailerName} label="Returns" value={returnsLabel(b)} best={tonesDiffer && toneRank(b) > toneRank(a)} sub={short(b.returnsNote)} />
        </div>
      </Reveal>
    </section>
  );
}
