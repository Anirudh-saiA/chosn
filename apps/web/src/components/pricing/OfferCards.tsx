import { ArrowUpRight, Check, CreditCard, Info, RotateCcw, Tag, Truck, X } from 'lucide-react';
import { formatInr, type CatalogOffer } from '@/lib/catalog';
import { deliveryDays, formatDelivery, isEligible, pickBestToBuy } from '@/lib/recommend';
import { shippingInfo } from '@/lib/shipping';
import { whyBuy } from '@/lib/why-buy';

/** One colour language across the section: green = good, amber = middling, red = worse, navy = our pick. */
const GREEN = '#1F8A4C';
const AMBER = '#C77700';
const RED = '#C23A2B';
const NAVY = '#14213D';
const BLUE = '#2F63C8';

function priceColor(price: number, min: number) {
  const over = (price - min) / min;
  return over <= 0.001 ? GREEN : over <= 0.1 ? AMBER : RED;
}

function deliveryColor(days: number | null) {
  if (days === null) return '#6C7386';
  return days <= 5 ? GREEN : days <= 7 ? AMBER : RED;
}

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full px-3 py-1 font-mono text-[0.72rem] font-bold uppercase tracking-[0.12em] text-white" style={{ background: color }}>
      {children}
    </span>
  );
}

/**
 * The stores selling this shoe in this size, as big, plainly-coloured cards: who, how much, how fast, how you
 * can pay, what offers run, and why to buy there. Recommended store first, then by price. Stores whose prices
 * are demo data are not shown as offers; stores that are sold out here are listed underneath.
 */
export function OfferCards({ offers, size }: { offers: CatalogOffer[]; size: string }) {
  const live = offers.filter(isEligible).sort((a, b) => (a.effectivePriceInr as number) - (b.effectivePriceInr as number));
  const soldOut = offers.filter((o) => o.mode !== 'fixture' && !isEligible(o));
  const demo = offers.filter((o) => o.mode === 'fixture');
  if (live.length === 0) {
    return (
      <div className="rounded-3xl border border-text/10 bg-white p-8 text-center">
        <p className="text-[1.05rem] font-semibold text-text">No connected store has UK {size} in stock right now.</p>
        {soldOut.length > 0 && <p className="mt-2 text-text-soft">Sold out at {soldOut.map((o) => o.retailerName).join(', ')}.</p>}
      </div>
    );
  }

  const pick = pickBestToBuy(offers);
  const ordered = pick ? [pick.offer, ...live.filter((o) => o.retailerSlug !== pick.offer.retailerSlug)] : live;
  const prices = live.map((o) => o.effectivePriceInr as number);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const dayOf = (o: CatalogOffer) => deliveryDays(o);

  return (
    <div>
      {/* Price range, like a ruler: every store is a dot, cheapest on the left */}
      <div className="mb-6 rounded-3xl border border-text/10 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[0.72rem] font-bold uppercase tracking-[0.16em] text-text-faint">Best price for UK {size}</p>
            <p className="mt-1 font-mono text-[clamp(2rem,5vw,2.8rem)] font-extrabold leading-none tabular-nums" style={{ color: GREEN }}>
              {formatInr(min)}
            </p>
          </div>
          <p className="text-[1rem] text-text-soft">
            Across <strong className="text-text">{live.length}</strong> {live.length === 1 ? 'store' : 'stores'}: {formatInr(min)} – {formatInr(max)}
          </p>
        </div>
        {live.length > 1 && (
          <div className="relative mt-6 h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${GREEN}, ${AMBER} 55%, ${RED})` }} aria-hidden>
            {live.map((o) => (
              <span
                key={o.retailerSlug}
                className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-[#0A0A0A] shadow"
                style={{ left: `${max === min ? 0 : (((o.effectivePriceInr as number) - min) / (max - min)) * 100}%` }}
                title={`${o.retailerName} ${formatInr(o.effectivePriceInr as number)}`}
              />
            ))}
          </div>
        )}
      </div>

      <ul className="flex flex-col gap-5">
        {ordered.map((o) => {
          const p = o.effectivePriceInr as number;
          const why = whyBuy(o, offers);
          const isPick = pick?.offer.retailerSlug === o.retailerSlug;
          const delivery = formatDelivery(o);
          const dColor = deliveryColor(dayOf(o));
          const pColor = priceColor(p, min);
          const ship = shippingInfo(o);
          const methods = o.paymentMethods ?? [];
          const liveOffers = o.offers ?? [];
          const returnsColor = o.returnsTone === 'ok' ? GREEN : o.returnsTone === 'limited' ? AMBER : o.returnsTone === 'none' ? RED : '#6C7386';
          return (
            <li key={o.retailerSlug} className={`overflow-hidden rounded-3xl bg-white ${isPick ? 'border-[3px]' : 'border border-text/15'}`} style={isPick ? { borderColor: NAVY } : undefined}>
              <div className="p-5 sm:p-7">
                {/* Who and how much */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {isPick && <Pill color={NAVY}>Recommended</Pill>}
                      {why.isCheapest && <Pill color={GREEN}>Lowest price</Pill>}
                      {why.isFastest && <Pill color={BLUE}>Fastest delivery</Pill>}
                    </div>
                    <h3 className="mt-2 font-display text-[clamp(1.7rem,4vw,2.3rem)] font-bold leading-tight text-text">{o.retailerName}</h3>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[clamp(2rem,5vw,2.7rem)] font-extrabold leading-none tabular-nums" style={{ color: pColor }}>
                      {formatInr(p)}
                    </p>
                    <p className="mt-1.5 text-[0.95rem] font-semibold" style={{ color: pColor }}>
                      {p - min < 1 ? 'Lowest price' : `+${formatInr(p - min)} vs lowest`}
                    </p>
                  </div>
                </div>

                {/* The three things people compare */}
                <dl className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-[#F6F2EA] p-4">
                    <dt className="flex items-center gap-1.5 font-mono text-[0.68rem] font-bold uppercase tracking-[0.14em] text-text-faint">
                      <Truck className="h-4 w-4" aria-hidden /> Delivery
                    </dt>
                    <dd className="mt-1.5 text-[1.3rem] font-bold" style={{ color: dColor }}>
                      {delivery ?? 'Not published'}
                    </dd>
                    {o.deliveryNote && <p className="mt-1 text-[0.8rem] leading-snug text-text-soft">{o.deliveryNote}</p>}
                  </div>
                  <div className="rounded-2xl bg-[#F6F2EA] p-4">
                    <dt className="flex items-center gap-1.5 font-mono text-[0.68rem] font-bold uppercase tracking-[0.14em] text-text-faint">
                      <Tag className="h-4 w-4" aria-hidden /> Shipping
                    </dt>
                    <dd className="mt-1.5 text-[1.3rem] font-bold" style={{ color: ship.tone === 'good' ? GREEN : ship.tone === 'warn' ? AMBER : '#6C7386' }}>
                      {ship.label}
                    </dd>
                    {o.shippingNote && <p className="mt-1 text-[0.8rem] leading-snug text-text-soft">{o.shippingNote}</p>}
                  </div>
                  <div className="rounded-2xl bg-[#F6F2EA] p-4">
                    <dt className="flex items-center gap-1.5 font-mono text-[0.68rem] font-bold uppercase tracking-[0.14em] text-text-faint">
                      <RotateCcw className="h-4 w-4" aria-hidden /> Returns
                    </dt>
                    <dd className="mt-1.5 text-[1.05rem] font-bold leading-snug" style={{ color: returnsColor }}>
                      {o.returnsNote ?? 'Not stated'}
                    </dd>
                  </div>
                </dl>

                {/* Why buy here */}
                {(why.good.length > 0 || why.caution.length > 0) && (
                  <div className="mt-5">
                    <p className="font-mono text-[0.72rem] font-bold uppercase tracking-[0.16em] text-text-faint">Why buy from {o.retailerName}</p>
                    <ul className="mt-2.5 space-y-2">
                      {why.good.map((g) => (
                        <li key={g} className="flex items-start gap-2.5 text-[1.02rem] font-medium text-text">
                          <Check className="mt-0.5 h-5 w-5 shrink-0" style={{ color: GREEN }} aria-hidden /> {g}
                        </li>
                      ))}
                      {why.caution.map((c) => (
                        <li key={c} className="flex items-start gap-2.5 text-[1.02rem] font-medium" style={{ color: RED }}>
                          <X className="mt-0.5 h-5 w-5 shrink-0" aria-hidden /> {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* How you can pay (only what the store says) */}
                {methods.length > 0 && (
                  <div className="mt-5">
                    <p className="flex items-center gap-1.5 font-mono text-[0.72rem] font-bold uppercase tracking-[0.16em] text-text-faint">
                      <CreditCard className="h-4 w-4" aria-hidden /> Pay with
                    </p>
                    <ul className="mt-2.5 flex flex-wrap gap-2">
                      {methods.map((m) => (
                        <li key={m} className="rounded-full border-2 border-text/15 px-3.5 py-1.5 text-[0.95rem] font-semibold text-text">
                          {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Live offers */}
                {liveOffers.length > 0 && (
                  <div className="mt-5">
                    <p className="flex items-center gap-1.5 font-mono text-[0.72rem] font-bold uppercase tracking-[0.16em]" style={{ color: AMBER }}>
                      <Tag className="h-4 w-4" aria-hidden /> Offers on this store
                    </p>
                    <ul className="mt-2.5 space-y-2">
                      {liveOffers.map((off) => (
                        <li key={off.text} className="rounded-xl px-4 py-2.5 text-[1rem] font-bold" style={{ background: '#FFF1D6', color: '#8A4B00' }}>
                          {off.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <a
                  href={o.listingUrl}
                  target="_blank"
                  rel="nofollow sponsored noopener"
                  aria-label={`Buy at ${o.retailerName} for ${formatInr(p)} (opens in a new tab)`}
                  className="mt-6 inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full px-8 font-mono text-[0.9rem] font-bold uppercase tracking-[0.14em] transition-colors"
                  style={isPick ? { background: NAVY, color: '#fff' } : { border: `2px solid ${NAVY}`, color: NAVY }}
                >
                  Buy at {o.retailerName} <ArrowUpRight className="h-5 w-5" aria-hidden />
                </a>
                {o.infoSourceUrl && (
                  <p className="mt-2.5 text-center text-[0.74rem] text-text-faint">
                    Payment, shipping and return details are from the store&apos;s own{' '}
                    <a href={o.infoSourceUrl} target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-text">
                      page
                    </a>
                    .
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {(soldOut.length > 0 || demo.length > 0) && (
        <div className="mt-5 space-y-1.5 text-[0.9rem] text-text-soft">
          {soldOut.length > 0 && (
            <p>
              <strong className="text-text">Sold out in UK {size}:</strong> {soldOut.map((o) => o.retailerName).join(', ')}.
            </p>
          )}
          {demo.length > 0 && (
            <p>
              <strong className="text-text">Not connected yet:</strong> {demo.map((o) => o.retailerName).join(', ')}. Their prices are placeholders, so they are not shown as offers.
            </p>
          )}
        </div>
      )}

      <p className="mt-4 flex items-start gap-2 rounded-2xl bg-[#F6F2EA] px-4 py-3 text-[0.85rem] leading-relaxed text-text-soft">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          Reviews are not part of this comparison: these stores do not publish reviews we can read, and we will not make up ratings. The recommendation weighs total price and delivery time.
        </span>
      </p>
    </div>
  );
}
