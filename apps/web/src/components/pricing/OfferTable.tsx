import { ArrowUpRight, Trophy } from 'lucide-react';
import { buttonVariantClass, cx } from '@chosn/ui';
import { formatInr, relativeTime, type CatalogOffer } from '@/lib/catalog';

export interface OfferTableProps {
  offers: CatalogOffer[];
}

/**
 * Day 20: a fixture-mode offer (credentials never approved, price/URL
 * are placeholder data — see CatalogOffer.mode) must never win the one
 * highlighted "best deal" slot. Recommending fabricated data as the
 * cheapest real price is the single worst trust failure this page can
 * produce.
 */
export function findBestOffer(offers: CatalogOffer[]): CatalogOffer | null {
  return (
    offers.find((o) => o.mode !== 'fixture' && o.inStock && !o.isStale && o.effectivePriceInr !== null) ?? null
  );
}

/**
 * A ranked terminal table — still a real <table> (a comparison is what
 * this data is). Rank badges order the genuinely purchasable offers by
 * effective price; rows keep the API's order. The cheapest in-stock,
 * non-stale, non-fixture row gets brass treatment and the one primary
 * CTA on the page; every other row stays secondary.
 */
export function OfferTable({ offers }: OfferTableProps) {
  if (offers.length === 0) {
    return (
      <div className="panel px-6 py-10 text-center">
        <p className="text-body text-text-soft">No retailers currently tracked for this size.</p>
      </div>
    );
  }

  const best = findBestOffer(offers);

  // Rank only live, fresh, in-stock offers so #1 is always the best deal.
  const ranked = offers
    .filter((o) => o.mode !== 'fixture' && o.inStock && !o.isStale && o.effectivePriceInr !== null)
    .sort((a, b) => (a.effectivePriceInr as number) - (b.effectivePriceInr as number));
  const rankOf = new Map(ranked.map((o, i) => [o.retailerSlug, i + 1]));

  return (
    <div className="panel ticks overflow-x-auto">
      <table className="w-full border-collapse text-left md:min-w-[860px]">
        <caption className="sr-only">Retailer offers ranked by price for the selected size</caption>
        <thead>
          <tr className="border-b border-text/[0.1] bg-vault-deep/60">
            {[
              ['Rank', ''],
              ['Retailer', ''],
              ['Price', ''],
              ['Shipping', 'hidden md:table-cell'],
              ['Condition', 'hidden md:table-cell'],
              ['Status', 'hidden md:table-cell'],
              ['Updated', 'hidden md:table-cell'],
              ['', ''],
            ].map(([h, cls], i) => (
              <th
                key={i}
                scope="col"
                className={cx(
                  'whitespace-nowrap px-2.5 py-3 font-mono text-[0.68rem] sm:px-4 font-medium uppercase tracking-[0.14em] text-text-faint',
                  cls,
                )}
              >
                {h || <span className="sr-only">{i === 7 ? 'Action' : ''}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {offers.map((offer) => (
            <OfferRow
              key={offer.retailerSlug}
              offer={offer}
              rank={rankOf.get(offer.retailerSlug) ?? null}
              isBest={best?.retailerSlug === offer.retailerSlug}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OfferRow({ offer, rank, isBest }: { offer: CatalogOffer; rank: number | null; isBest: boolean }) {
  const isFixture = offer.mode === 'fixture';
  const unavailable = !offer.inStock || offer.effectivePriceInr === null;

  return (
    <tr
      className={cx(
        'border-b border-text/[0.07] transition-colors last:border-b-0 hover:bg-vault-high/60',
        isBest && 'bg-brass/[0.07]',
      )}
    >
      <td className={cx('whitespace-nowrap py-4 pl-3 pr-1 sm:pl-4 sm:pr-2', isBest && 'shadow-[inset_3px_0_0_0_#ffa800]')}>
        <span
          className={cx(
            'inline-flex h-7 w-7 items-center sm:h-8 sm:w-8 justify-center border font-mono text-sm font-semibold tabular-nums',
            isBest
              ? 'border-brass-bright/60 bg-brass-gradient text-vault-deep'
              : 'border-text/15 bg-vault-deep/60 text-text-soft',
          )}
        >
          {rank != null ? (
            <>
              <span className="sr-only">Rank </span>
              {rank}
            </>
          ) : (
            <span aria-label="Not ranked">–</span>
          )}
        </span>
      </td>
      <td className="max-w-[9rem] px-2 py-4 sm:max-w-none sm:px-4">
        <span className="font-sans text-data-inline font-semibold text-text">{offer.retailerName}</span>
        <span className="mt-0.5 block text-meta md:hidden">
          <StatusCell offer={offer} isFixture={isFixture} />
        </span>
        {isBest && (
          <span className="mt-1 flex items-center gap-1.5 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-brass-bright">
            <Trophy className="h-3 w-3" aria-hidden /> Best deal
          </span>
        )}
      </td>
      <td
        className={cx(
          'whitespace-nowrap px-2.5 py-4 font-mono text-[0.95rem] font-medium sm:px-4 tabular-nums sm:text-xl',
          isBest ? 'text-brass-bright' : 'text-text',
        )}
      >
        {unavailable ? (
          <span className="text-text-soft">—</span>
        ) : (
          formatInr(offer.effectivePriceInr as number)
        )}
        {offer.currency !== 'INR' && !unavailable && (
          <span className="ml-1.5 text-meta font-normal text-text-faint">
            ({offer.currency} {offer.price.toFixed(2)})
          </span>
        )}
      </td>
      <td className="hidden whitespace-nowrap px-4 py-4 font-mono text-data-inline tabular-nums text-text-soft md:table-cell">
        {offer.shippingCost > 0 ? formatInr(offer.shippingCost) : 'Free'}
      </td>
      <td className="hidden whitespace-nowrap px-4 py-4 font-sans text-data-inline capitalize text-text-soft md:table-cell">
        {offer.condition}
      </td>
      <td className="hidden whitespace-nowrap px-4 py-4 font-sans text-data-inline md:table-cell">
        <StatusCell offer={offer} isFixture={isFixture} />
      </td>
      <td className="hidden whitespace-nowrap px-4 py-4 font-mono text-meta text-text-soft md:table-cell">
        {relativeTime(offer.fetchedAt)}
      </td>
      <td className="whitespace-nowrap py-4 pl-0 pr-2.5 text-right sm:pl-4 sm:pr-4">
        {isFixture ? (
          // This retailer's integration was never approved — price and
          // listingUrl are placeholder data with nowhere real to send a
          // click (see retailer-mode.ts). No "View deal" button here,
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
            aria-label={`View deal at ${offer.retailerName}${offer.effectivePriceInr ? `, ${formatInr(offer.effectivePriceInr)}` : ''} (opens in a new tab)`}
            className={buttonVariantClass(isBest ? 'primary' : 'secondary', 'min-h-[44px] px-2.5 py-2 text-meta sm:px-4')}
          >
            View deal
            <ArrowUpRight className="hidden h-4 w-4 sm:block" aria-hidden />
          </a>
        )}
      </td>
    </tr>
  );
}

function StatusCell({ offer, isFixture }: { offer: CatalogOffer; isFixture: boolean }) {
  let dot = 'bg-signal shadow-[0_0_8px_1px_rgba(46,242,166,.6)]';
  let text = 'text-signal';
  let label = 'In stock';
  if (isFixture) {
    dot = 'bg-rust';
    text = 'text-rust';
    label = 'Demo price — not live yet';
  } else if (!offer.inStock) {
    dot = 'bg-text-faint';
    text = 'text-text-soft';
    label = 'Currently unavailable';
  } else if (offer.isStale) {
    dot = 'bg-rust';
    text = 'text-rust';
    label = 'Price data may be outdated';
  }
  return (
    <span className={cx('inline-flex items-center gap-2', text)}>
      <span aria-hidden className={cx('h-1.5 w-1.5 shrink-0 rounded-full', dot)} />
      {label}
    </span>
  );
}
