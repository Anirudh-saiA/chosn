import { buttonVariantClass } from '@chosn/ui';
import { formatInr, relativeTime, type CatalogOffer } from '@/lib/catalog';

export interface OfferTableProps {
  offers: CatalogOffer[];
}

/**
 * One border/radius language throughout — Card's hairline rule, applied
 * to a real <table> rather than a stack of per-row cards. A comparison
 * table is what this data actually is; dressing each row as its own
 * rounded-shadow card (Taste Skill's flagged default, and it applies
 * here regardless of which tool checks for it) would suggest six
 * unrelated products instead of six prices for the same one.
 *
 * The cheapest in-stock, non-stale row gets the one "primary" (filled
 * Brass) button on the page — a real signal (this is the recommended
 * deal), not decoration; every other row stays secondary so the table
 * doesn't read as six equally-loud calls to action.
 */
export function OfferTable({ offers }: OfferTableProps) {
  if (offers.length === 0) {
    return (
      <div className="border border-moss/25 bg-vault-raised p-6 text-center">
        <p className="text-body text-text-soft">No retailers currently tracked for this size.</p>
      </div>
    );
  }

  // Day 20: a fixture-mode offer (credentials never approved, price/URL
  // are placeholder data — see CatalogOffer.mode) must never win the one
  // highlighted "best deal" slot. Recommending fabricated data as the
  // cheapest real price is the single worst trust failure this page can
  // produce.
  const bestRowIndex = offers.findIndex(
    (o) => o.mode !== 'fixture' && o.inStock && !o.isStale && o.effectivePriceInr !== null,
  );

  return (
    <div className="overflow-x-auto border border-moss/25 bg-vault-raised">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="border-b border-moss/25">
            {['Retailer', 'Price', 'Shipping', 'Condition', 'Status', 'Updated', ''].map((h) => (
              <th
                key={h}
                scope="col"
                className="whitespace-nowrap px-4 py-3 font-mono text-meta font-medium uppercase tracking-[0.06em] text-text-faint"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {offers.map((offer, i) => (
            <OfferRow key={offer.retailerSlug} offer={offer} isBest={i === bestRowIndex} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OfferRow({ offer, isBest }: { offer: CatalogOffer; isBest: boolean }) {
  const isFixture = offer.mode === 'fixture';
  const unavailable = !offer.inStock || offer.effectivePriceInr === null;

  return (
    <tr className="border-b border-moss/15 last:border-b-0">
      <td className="whitespace-nowrap px-4 py-3 font-sans text-data-inline font-medium text-text">
        {offer.retailerName}
      </td>
      <td className="whitespace-nowrap px-4 py-3 font-mono text-data-inline tabular-nums text-text">
        {unavailable ? (
          <span className="text-text-soft">—</span>
        ) : (
          formatInr(offer.effectivePriceInr as number)
        )}
        {offer.currency !== 'INR' && !unavailable && (
          <span className="ml-1.5 text-meta text-text-faint">
            ({offer.currency} {offer.price.toFixed(2)})
          </span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 font-mono text-data-inline tabular-nums text-text-soft">
        {offer.shippingCost > 0 ? formatInr(offer.shippingCost) : 'Free'}
      </td>
      <td className="whitespace-nowrap px-4 py-3 font-sans text-data-inline capitalize text-text-soft">
        {offer.condition}
      </td>
      <td className="whitespace-nowrap px-4 py-3 font-sans text-data-inline">
        {isFixture ? (
          <span className="text-rust">Demo price — not live yet</span>
        ) : !offer.inStock ? (
          <span className="text-text-faint">Currently unavailable</span>
        ) : offer.isStale ? (
          <span className="text-rust">Price data may be outdated</span>
        ) : (
          <span className="text-signal">In stock</span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 font-mono text-meta text-text-faint">
        {relativeTime(offer.fetchedAt)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        {isFixture ? (
          // This retailer's integration was never approved — price and
          // listingUrl are placeholder data with nowhere real to send a
          // click (see retailer-mode.ts). No "View Deal" button here,
          // ever, until the adapter's isConfigured flips to true.
          <span
            className="text-meta text-text-faint"
            title="This retailer isn't connected yet — the price above is placeholder data, not a real offer."
          >
            Not yet available
          </span>
        ) : unavailable ? (
          <span className="text-meta text-text-faint">No deal</span>
        ) : (
          <a
            href={offer.listingUrl}
            target="_blank"
            rel="nofollow sponsored noopener"
            className={buttonVariantClass(isBest ? 'primary' : 'secondary', 'px-4 py-2 text-meta')}
          >
            View Deal
          </a>
        )}
      </td>
    </tr>
  );
}
