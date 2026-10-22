'use client';

import { useState } from 'react';
import { track as trackClick } from '@/lib/track';
import { rememberPurchase } from '@/lib/purchases';
import { ArrowUpRight, ChevronDown, Copy, Star } from 'lucide-react';
import { formatInr, type CatalogOffer, type PaymentGroup, type StoreOffer } from '@/lib/catalog';
import { acceptedPayments } from '@/lib/buy-guide';
import { formatDelivery } from '@/lib/recommend';
import { shippingInfo } from '@/lib/shipping';

const KIND_LABEL: Record<string, string> = {
  sale: 'Sale',
  coupon: 'Coupon',
  bank: 'Bank offer',
  card: 'Card offer',
  wallet: 'Wallet',
  emi: 'EMI',
  shipping: 'Shipping',
  credit: 'Credit',
  info: 'Note',
};

const label = 'font-mono text-[0.66rem] font-bold uppercase tracking-[0.18em] text-text-faint';

function CopyCode({ code }: { code: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        try {
          void navigator.clipboard.writeText(code);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked: the code is still on screen */
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-text/30 px-2 py-0.5 font-mono text-[0.75rem] font-bold tracking-[0.08em] text-text hover:bg-text/5"
      aria-label={`Copy code ${code}`}
    >
      {code} <Copy className="h-3 w-3" aria-hidden /> {done && <span className="text-[0.66rem] text-[#1F8A4C]">copied</span>}
    </button>
  );
}

function Payments({ groups, flat }: { groups: PaymentGroup[]; flat: string[] }) {
  if (groups.length === 0 && flat.length === 0) return <p className="text-[0.88rem] text-text-soft">This store does not say how you can pay.</p>;
  if (groups.length === 0)
    return (
      <ul className="flex flex-wrap gap-1.5">
        {flat.map((m) => (
          <li key={m} className="rounded-full border border-text/15 px-2.5 py-0.5 text-[0.8rem] text-text">
            {m}
          </li>
        ))}
      </ul>
    );
  // Groups that are just one word (UPI, Net banking, Cash on delivery) share a single row of chips.
  const simple = groups.filter((g) => !g.unavailable && g.items.length === 1 && g.items[0]!.toLowerCase() === g.label.toLowerCase());
  const rich = groups.filter((g) => !simple.includes(g) && !g.unavailable);
  const no = groups.filter((g) => g.unavailable);
  return (
    <div className="space-y-3.5">
      {simple.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {simple.map((g) => (
            <li key={g.label} className="rounded-full border border-text/15 px-2.5 py-0.5 text-[0.8rem] text-text">
              {g.label}
            </li>
          ))}
        </ul>
      )}
      {rich.map((g) => (
        <div key={`${g.kind}-${g.label}`}>
          <p className="text-[0.84rem] font-bold text-text">{g.label}</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {g.items.map((m) => (
              <li key={m} className="rounded-full border border-text/15 px-2.5 py-0.5 text-[0.8rem] text-text">
                {m}
              </li>
            ))}
          </ul>
          {g.note && <p className="mt-1 text-[0.76rem] leading-snug text-text-soft">{g.note}</p>}
        </div>
      ))}
      {no.map((g) => (
        <p key={g.label} className="text-[0.8rem] text-text-faint">
          {g.label}: {g.note?.toLowerCase() ?? 'not available'}
        </p>
      ))}
    </div>
  );
}

function Offers({ offers }: { offers: StoreOffer[] }) {
  if (offers.length === 0) return <p className="text-[0.88rem] text-text-soft">No offers listed by this store right now.</p>;
  return (
    <ul className="space-y-3">
      {offers.map((o) => (
        <li key={o.text} className="text-[0.88rem] leading-snug text-text">
          <span className="mr-2 rounded bg-[#FFD54A] px-1.5 py-0.5 font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[#0A0A0A]">{KIND_LABEL[o.kind] ?? 'Offer'}</span>
          {o.text}
          {o.code && (
            <span className="ml-2 align-middle">
              <CopyCode code={o.code} />
            </span>
          )}
          {(o.conditions || o.seenAt) && (
            <span className="mt-0.5 block text-[0.74rem] text-text-faint">
              {o.conditions}
              {o.conditions && o.seenAt ? ' · ' : ''}
              {o.seenAt ? `seen ${o.seenAt}` : ''}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** One store: logo, price, delivery and a Buy button on one line; payment options, offers and the fine print open below. */
export function StoreRow({
  offer,
  min,
  isBest,
  fastest,
  defaultOpen,
  labels,
  value,
  slowerDays = 0,
  track: trackInfo,
  chosenBy = 0,
}: {
  offer: CatalogOffer;
  min: number;
  isBest: boolean;
  fastest: boolean;
  defaultOpen: boolean;
  /** Badges to show next to the name, e.g. "Best value", "Lowest price", "Fastest". */
  labels?: string[];
  /** The store's Value score and how it was worked out. */
  value?: { score: number; note: string };
  /** How many days slower than the fastest store that publishes a time. */
  slowerDays?: number;
  /** Where this row sits and how the list is sorted, recorded when Buy is pressed. */
  track?: { styleCode: string; size?: number; position: number; sort: 'value' | 'price' | 'fastest'; shoeName?: string };
  /** How many shoppers chose this store for this shoe lately (anonymous). */
  chosenBy?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const price = offer.effectivePriceInr as number;
  const delivery = formatDelivery(offer);
  const ship = shippingInfo(offer);
  const extra = price - min;
  const offers = offer.offers ?? [];
  const pays = acceptedPayments(offer);

  return (
    <li className={`overflow-hidden rounded-2xl bg-white ${isBest ? 'border-2 border-[#14213D]' : 'border border-text/12'}`}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 p-4 sm:p-5">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-4 text-left">
          {offer.retailerLogoUrl ? (
            <img src={offer.retailerLogoUrl} alt="" className="h-9 w-auto max-w-[8rem] shrink-0 rounded-md object-contain" />
          ) : null}
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-display text-[1.45rem] font-bold leading-none text-text">{offer.retailerName}</span>
              {labels
                ? labels.map((l, i) => (
                    <span key={l} className={`rounded-full px-2 py-0.5 font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] ${i === 0 && isBest ? 'bg-[#14213D] text-white' : 'border border-text/20 text-text-soft'}`}>
                      {l}
                    </span>
                  ))
                : (
                  <>
                    {isBest && <span className="rounded-full bg-[#14213D] px-2 py-0.5 font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-white">Lowest price</span>}
                    {fastest && <span className="rounded-full border border-text/20 px-2 py-0.5 font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-text-soft">Fastest</span>}
                  </>
                )}
            </span>
            <span className="mt-1 block text-[0.82rem] text-text-soft">
              {chosenBy >= 3 ? <span className="mr-2 font-semibold text-text">{chosenBy} shoppers chose this store for this shoe</span> : null}
              {delivery ? `Delivery ${delivery}` : 'Delivery not published'}
              {ship.free ? ' · Free shipping' : ''}
              {offers.length > 0 ? ` · ${offers.length} offer${offers.length === 1 ? '' : 's'}` : ''}
            </span>
            {offer.rating != null && (offer.reviewCount ?? 0) > 0 && (
              <span className="mt-0.5 flex items-center gap-1 text-[0.82rem] font-semibold text-text">
                <Star className="h-3.5 w-3.5 fill-[#FFB400] text-[#FFB400]" aria-hidden />
                {offer.rating.toFixed(1)}
                <span className="font-normal text-text-soft">
                  ({offer.reviewCount!.toLocaleString('en-IN')} ratings{offer.ratingSource ? ` on ${offer.ratingSource}` : ''})
                </span>
              </span>
            )}
            {pays.length > 0 && <span className="mt-0.5 block text-[0.78rem] text-text-faint">Pay: {pays.join(' · ')}</span>}
          </span>
          <ChevronDown className={`ml-auto h-5 w-5 shrink-0 text-text-faint transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        <div className="text-right">
          <p className="font-mono text-[1.6rem] font-extrabold leading-none tabular-nums text-text">{formatInr(price)}</p>
          <p className="mt-1 text-[0.78rem] text-text-soft">
            {extra < 1 ? 'Lowest price' : `+${formatInr(extra)}`}
            {slowerDays >= 1 ? ` · ${Math.round(slowerDays)}d slower` : ''}
          </p>
          {offer.trustScore != null &&
            (offer.trustConfidence === 'low' ? (
              <p className="mt-1" title={`Provisional ${offer.trustScore}/100, mostly neutral because we have no reviews or cited standing for this store yet. Open the row for the working.`}>
                <span className="inline-flex cursor-help items-center rounded-full bg-text/[0.06] px-2 py-0.5 font-mono text-[0.66rem] font-bold text-text-soft">Trust: not enough evidence yet</span>
              </p>
            ) : (
              <p className="mt-1" title={`Trust ${offer.trustScore}/100 (${offer.trustConfidence ?? 'low'} confidence). ${(offer.trustDetail?.why ?? []).join(' ')}`}>
                <span className="inline-flex cursor-help items-center gap-1 rounded-full bg-[#1B7A34]/10 px-2 py-0.5 font-mono text-[0.66rem] font-bold text-[#1B7A34]">
                  Trust {offer.trustScore}
                  <span className="font-semibold normal-case opacity-70">· {offer.trustConfidence ?? 'low'} confidence</span>
                </span>
              </p>
            ))}
          {value && (
            <p className="mt-1" title={value.note}>
              <span className="inline-flex cursor-help items-center gap-1 rounded-full bg-[#14213D]/[0.07] px-2 py-0.5 font-mono text-[0.66rem] font-bold text-[#14213D]">Value {value.score}/100</span>
            </p>
          )}
        </div>
        <a
          href={offer.listingUrl}
          target="_blank"
          rel="nofollow sponsored noopener"
          aria-label={`Buy at ${offer.retailerName} for ${formatInr(price)} (opens in a new tab)`}
          onClick={() => trackInfo && (rememberPurchase({ styleCode: trackInfo.styleCode, size: trackInfo.size, store: offer.retailerSlug, storeName: offer.retailerName, shoeName: trackInfo.shoeName ?? trackInfo.styleCode, promisedMaxDays: offer.deliveryMaxDays }), trackClick({ event: 'click', styleCode: trackInfo.styleCode, size: trackInfo.size, store: offer.retailerSlug, price, position: trackInfo.position, sort: trackInfo.sort }))}
          className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-5 font-mono text-[0.74rem] font-bold uppercase tracking-[0.14em] transition-colors ${
            isBest ? 'bg-[#14213D] text-white hover:bg-[#0A0A0A]' : 'border-2 border-[#14213D] text-[#14213D] hover:bg-[#14213D]/5'
          }`}
        >
          Buy <ArrowUpRight className="h-4 w-4" aria-hidden />
        </a>
      </div>

      {open && (
        <div className="grid gap-x-10 gap-y-6 border-t border-text/10 bg-[#F1F7FB]/60 p-4 sm:grid-cols-2 sm:p-5">
          <div>
            <p className={label}>Pay with</p>
            <div className="mt-2.5">
              <Payments groups={offer.paymentOptions ?? []} flat={offer.paymentMethods ?? []} />
            </div>
          </div>
          <div>
            <p className={label}>Offers</p>
            <div className="mt-2.5">
              <Offers offers={offers} />
            </div>
          </div>
          <dl className="grid gap-x-10 gap-y-2 text-[0.84rem] sm:col-span-2 sm:grid-cols-3">
            <div>
              <dt className={label}>Shipping</dt>
              <dd className="mt-1 leading-snug text-text">{offer.shippingNote ?? 'Not stated'}</dd>
            </div>
            <div>
              <dt className={label}>Delivery</dt>
              <dd className="mt-1 leading-snug text-text">{offer.deliveryNote ?? delivery ?? 'Not published'}</dd>
            </div>
            <div>
              <dt className={label}>Returns</dt>
              <dd className="mt-1 leading-snug text-text">{offer.returnsNote ?? 'Not stated'}</dd>
            </div>
          </dl>
          {offer.trustScore != null && offer.trustDetail && (
            <div className="sm:col-span-2">
              <p className={label}>
                {offer.trustConfidence === 'low' ? `Trust: not enough evidence yet (provisional ${offer.trustScore}/100)` : `Trust score ${offer.trustScore}/100 · ${offer.trustConfidence ?? 'low'} confidence`}
              </p>
              <ul className="mt-2 space-y-1 text-[0.82rem] leading-snug text-text">
                {offer.trustDetail.why.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
              <p className="mt-2 text-[0.74rem] text-text-faint">
                {offer.trustDetail.formula}. A part with no evidence stays neutral, so a store we know little about sits near 50 and says so.
                {offer.trustDetail.sources.length > 0 && (
                  <>
                    {' '}Sources:{' '}
                    {offer.trustDetail.sources.map((src, i) => (
                      <span key={src.url}>
                        {i > 0 && ', '}
                        <a href={src.url} target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-text">
                          {src.title.length > 60 ? `${src.title.slice(0, 58)}…` : src.title}
                        </a>
                      </span>
                    ))}
                    .
                  </>
                )}
              </p>
            </div>
          )}
          {offer.infoSourceUrl && (
            <p className="text-[0.72rem] text-text-faint sm:col-span-2">
              From the store&apos;s own{' '}
              <a href={offer.infoSourceUrl} target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-text">
                page
              </a>
              . Offers and payment options can change at checkout.
            </p>
          )}
        </div>
      )}
    </li>
  );
}
