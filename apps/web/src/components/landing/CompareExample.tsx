import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { ScrollHighlight } from './ScrollHighlight';
import { ScrollOn } from './ScrollOn';
import { Marquee } from '@/components/fx/Marquee';
import { Reveal } from '@/components/fx/Reveal';
import { fetchCatalogVariant, fetchSearch, formatInr, formatSize, type CatalogOffer, type CatalogResponse, type SearchResultItem } from '@/lib/catalog';
import { acceptedPayments } from '@/lib/buy-guide';
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
/** The shoe the landing example shows when it can be found at two stores; otherwise the most-compared shoe that can. */
const FEATURED = 'samba';
/** One flat colour behind the whole example (the page's own base colour), so none of the page's colour glow shows through. */
const FLAT = 'bg-[#FFFFFF]';

const VERDICT = {
  buy_now: { label: 'Buy now', pill: 'bg-[#0A6B44] text-white' },
  wait: { label: 'Wait', pill: 'bg-[#9A5A00] text-white' },
  fair: { label: 'Fair price', pill: 'bg-[#0A0A0A] text-white' },
  unclear: { label: 'Too early to say', pill: 'bg-[#0A0A0A]/10 text-[#0A0A0A]' },
} as const;

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
const short = (t: string | null, n = 70) => (t ? (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t) : undefined);

/** The first shoe in these results that two stores have in stock right now, with its real offers. */
async function pickFrom(results: SearchResultItem[]): Promise<Example | null> {
  for (const r of results.slice(0, 12)) {
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
  return null;
}

/**
 * A real comparison for the landing page: the featured shoe (or, failing that, the most-compared one) that two stores have in stock
 * right now, with its real prices and each store's own delivery estimate, payment options and returns rule. Nothing here is
 * illustrative; if no such shoe can be found the example is left out.
 */
async function loadExample(): Promise<Example | null> {
  try {
    const featured = await fetchSearch({ q: FEATURED }, REVALIDATE);
    const fromFeatured = await pickFrom(featured.results.filter((r) => r.model.toLowerCase().includes(FEATURED)));
    if (fromFeatured) return fromFeatured;
    return await pickFrom((await fetchSearch({}, REVALIDATE)).results);
  } catch {
    return null; // no example rather than a made-up one
  }
}

const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/** One store's value in one row of the table. */
interface Side {
  main?: string;
  sub?: string;
  chips?: string[];
  best?: string; // when set, this side wins the row and the text is the badge
}
interface Row {
  label: string;
  a: Side;
  b: Side;
  note: string;
}

function BestBadge({ text }: { text: string }) {
  return (
    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#0A6B44] px-2.5 py-0.5 font-mono text-[0.6rem] font-extrabold uppercase tracking-[0.14em] text-white">
      <Check className="h-3 w-3" aria-hidden /> {text}
    </span>
  );
}

function Cell({ side }: { side: Side }) {
  return (
    <td className={`align-top px-3 py-4 md:px-6 md:py-5 ${side.best ? 'bg-[#E3F3E9]' : ''}`}>
      {side.main ? <p className="font-mono text-[1.15rem] font-extrabold leading-tight text-[#0A0A0A] md:text-[1.7rem]">{side.main}</p> : null}
      {side.chips ? (
        side.chips.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {side.chips.slice(0, 6).map((m) => (
              <li key={m} className="rounded-full border border-[#0A0A0A]/15 bg-white px-2.5 py-0.5 text-[0.72rem] font-bold text-[#0A0A0A] md:text-[0.82rem]">
                {m}
              </li>
            ))}
            {side.chips.length > 6 ? <li className="px-1 py-0.5 text-[0.72rem] font-bold text-text-soft">+{side.chips.length - 6}</li> : null}
          </ul>
        ) : (
          <p className="font-mono text-[1.05rem] font-extrabold text-[#0A0A0A]/60">Not stated</p>
        )
      ) : null}
      {side.sub ? <p className="mt-1 text-[0.78rem] font-bold leading-snug text-text-soft md:text-[0.85rem]">{side.sub}</p> : null}
      {side.best ? <BestBadge text={side.best} /> : null}
    </td>
  );
}

function StoreHead({ offer, best }: { offer: CatalogOffer; best?: string }) {
  return (
    <th scope="col" className="bg-[#0A0A0A] px-3 py-4 text-left align-middle text-white md:px-6 md:py-5">
      <span className="flex flex-wrap items-center gap-2.5">
        {offer.retailerLogoUrl ? (
          <span className="flex h-8 w-12 shrink-0 items-center justify-center rounded-md bg-white px-1">
            <img src={offer.retailerLogoUrl} alt="" className="max-h-6 max-w-full object-contain" />
          </span>
        ) : null}
        <span className="font-display text-[1.05rem] uppercase leading-none tracking-[0.02em] md:text-[1.5rem]">{offer.retailerName}</span>
      </span>
      {best ? <span className="mt-2 inline-block rounded-full bg-white/15 px-2.5 py-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-[0.14em]">{best}</span> : null}
    </th>
  );
}

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
      <div className="mb-4 overflow-hidden rounded-full border border-[#0A0A0A]/10 bg-white py-4" aria-label="Retailers we compare">
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
      <div className={`w-full ${FLAT}`}>
        <section id="compare" className="mx-auto w-full max-w-[90rem] px-5 pb-20 pt-10 sm:px-8">
          {header}
        </section>
      </div>
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
  const payA = acceptedPayments(a);
  const payB = acceptedPayments(b);
  const hasCod = (m: string[]) => m.some((x) => /cash on delivery|\bcod\b/i.test(x));
  const payNote =
    payA.length === 0 && payB.length === 0
      ? 'Check each store'
      : hasCod(payA) !== hasCod(payB)
        ? `Cash on delivery at ${hasCod(payA) ? a.retailerName : b.retailerName}`
        : payA.length !== payB.length
          ? `${Math.abs(payA.length - payB.length)} more ways to pay at ${payA.length > payB.length ? a.retailerName : b.retailerName}`
          : 'Same ways to pay';
  const retOkA = a.returnsTone === 'ok';
  const retOkB = b.returnsTone === 'ok';
  // Store trust score: only shown when both stores have a score we trust; "not enough evidence" is not a row worth showing.
  const scored = (o: CatalogOffer) => o.trustScore != null && o.trustConfidence !== 'low';
  const showTrust = scored(a) && scored(b);
  const trustDiff = showTrust ? (b.trustScore as number) - (a.trustScore as number) : 0;

  const rows: Row[] = [
    {
      label: 'Price',
      a: { main: formatInr(priceA), sub: 'Cheapest listing', best: 'Cheapest' },
      b: { main: formatInr(priceB), sub: `${formatInr(priceB - priceA)} more` },
      note: `${formatInr(priceB - priceA)} cheaper at ${a.retailerName}`,
    },
    {
      label: 'Delivery',
      a: { main: formatDelivery(a) ?? 'Not stated', sub: a.shippingNote ? short(a.shippingNote, 52) : "The store's own estimate", best: fasterIsA ? 'Faster' : undefined },
      b: { main: formatDelivery(b) ?? 'Not stated', sub: b.shippingNote ? short(b.shippingNote, 52) : "The store's own estimate", best: fasterIsB ? 'Faster' : undefined },
      note: bothDays ? `${dayGap} ${dayGap === 1 ? 'day' : 'days'} faster at ${fasterIsA ? a.retailerName : b.retailerName}` : 'Check each store',
    },
    { label: 'Payment', a: { chips: payA }, b: { chips: payB }, note: payNote },
    {
      label: 'Returns',
      a: { main: returnsLabel(a), best: retOkA && !retOkB ? 'Better' : undefined },
      b: { main: returnsLabel(b), best: retOkB && !retOkA ? 'Better' : undefined },
      note: retOkA === retOkB ? (a.returnsTone === b.returnsTone ? 'Same return rule' : 'Check each store') : `${retOkA ? a.retailerName : b.retailerName} accepts returns`,
    },
  ];
  if (showTrust) {
    rows.push({
      label: 'Store trust',
      a: { main: `${a.trustScore}/100`, sub: `${a.trustConfidence} confidence`, best: trustDiff < 0 ? 'Higher' : undefined },
      b: { main: `${b.trustScore}/100`, sub: `${b.trustConfidence} confidence`, best: trustDiff > 0 ? 'Higher' : undefined },
      note: trustDiff !== 0 ? `${Math.abs(trustDiff)} points higher at ${trustDiff < 0 ? a.retailerName : b.retailerName}` : 'Similar trust',
    });
  }

  const readOn = [a.fetchedAt, b.fetchedAt].sort().slice(-1)[0] ?? a.fetchedAt;
  const name = `${data.sneaker.brand} ${data.sneaker.model}`;
  const image = resolveSneakerImage(data.sneaker.primaryImageUrl);
  const outlook = data.outlook ?? null;
  const reasons = outlook ? outlook.factors.filter((f) => f.points !== 0).slice(0, 3) : [];

  return (
    <div className={`w-full ${FLAT}`}>
      <section id="compare" className="mx-auto w-full max-w-[90rem] px-5 pb-20 pt-10 sm:px-8">
        {header}
        <Reveal>
          <div className="mb-5 flex flex-col items-center">
            {image && (
              // The photo's white square fades into the flat page colour (a soft oval mask), and the shoe is zoomed in so it is the hero.
              <div className="relative aspect-[2.4/1] w-[min(44rem,96vw)] overflow-hidden [mask-image:radial-gradient(ellipse_closest-side,#000_62%,transparent_100%)] [-webkit-mask-image:radial-gradient(ellipse_closest-side,#000_62%,transparent_100%)]">
                <img src={image} alt={`${name} ${data.sneaker.colorway}`} loading="lazy" decoding="async" draggable={false} className="absolute inset-0 h-full w-full scale-[2.4] select-none object-contain" />
              </div>
            )}
            <Link href={`/sneakers/${encodeURIComponent(data.sneaker.styleCode)}/${size}`} className="mt-2 inline-flex min-h-11 items-center text-center font-display text-[1.25rem] uppercase tracking-[0.02em] text-[#0A0A0A] hover:underline">
              {name} · UK {size}
            </Link>
            <p className="mt-1 font-mono text-[0.6rem] font-bold uppercase tracking-[0.22em] text-[#0A0A0A]/45">Real prices from our data · read {day(readOn)}</p>
          </div>

          <div className="overflow-hidden rounded-3xl border border-[#0A0A0A]/15 bg-white">
            <table className="w-full table-fixed border-collapse text-left">
              <caption className="sr-only">
                {name} UK {size}: {a.retailerName} compared with {b.retailerName}
              </caption>
              <colgroup>
                <col className="w-[4.5rem] md:w-[10rem]" />
                <col />
                <col />
                <col className="hidden md:table-column md:w-[15rem]" />
              </colgroup>
              <thead>
                <tr>
                  <td className="bg-[#0A0A0A]" />
                  <StoreHead offer={a} />
                  <StoreHead offer={b} />
                  <th scope="col" className="hidden bg-[#0A0A0A] px-6 py-5 text-left font-mono text-[0.62rem] font-bold uppercase tracking-[0.22em] text-white/70 md:table-cell">
                    The difference
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-t border-[#0A0A0A]/10">
                    <th scope="row" className="align-top px-3 py-4 text-left md:px-6 md:py-5">
                      <span className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.18em] text-[#0A0A0A]/55 md:text-[0.68rem]">{r.label}</span>
                      <span className={`${hand} mt-1 block text-[0.95rem] leading-tight text-[#E0740F] md:hidden`}>{r.note}</span>
                    </th>
                    <Cell side={r.a} />
                    <Cell side={r.b} />
                    <td className={`${hand} hidden align-middle px-6 py-5 text-[1.25rem] leading-tight text-[#E0740F] md:table-cell`}>{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Buy now or wait: one call for the shoe, with the reasons that moved it */}
          {outlook ? (
            <ScrollOn className="mt-6 rounded-2xl border border-[#0A0A0A]/15 bg-white px-6 py-5">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.22em] text-[#0A0A0A]/50">Buy now or wait</p>
                <span className={`rounded-full px-5 py-1.5 font-display text-[1.4rem] uppercase tracking-[0.04em] ${VERDICT[outlook.verdict].pill}`}>{VERDICT[outlook.verdict].label}</span>
                <p className="min-w-0 flex-1 text-[1rem] font-bold text-[#0A0A0A]">{outlook.headline}</p>
                <Link href={`/sneakers/${encodeURIComponent(data.sneaker.styleCode)}/${size}`} className="inline-flex min-h-11 items-center font-mono text-[0.72rem] font-bold uppercase tracking-[0.14em] text-[#0A0A0A]/70 underline underline-offset-4 hover:text-[#0A0A0A]">
                  See why
                </Link>
              </div>
              {reasons.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {reasons.map((f) => (
                    <li key={f.label} className="flex items-center gap-2 rounded-full border border-[#0A0A0A]/12 bg-[#FFFFFF] px-3.5 py-1.5 text-[0.85rem] font-bold text-[#0A0A0A]">
                      <span aria-hidden className={`flex h-4 w-4 items-center justify-center rounded-full text-[0.65rem] text-white ${f.effect === 'buy' ? 'bg-[#0A6B44]' : 'bg-[#9A5A00]'}`}>
                        {f.effect === 'buy' ? '+' : '−'}
                      </span>
                      {f.label}
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-3 font-mono text-[0.6rem] font-bold uppercase tracking-[0.2em] text-[#0A0A0A]/45">
                {outlook.confidence} confidence · an estimate from live prices and price history, not a promise
              </p>
            </ScrollOn>
          ) : null}
        </Reveal>
      </section>
    </div>
  );
}
