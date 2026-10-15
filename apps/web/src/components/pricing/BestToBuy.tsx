import { ArrowUpRight, Check, Info, Truck } from 'lucide-react';
import { formatInr, type CatalogOffer } from '@/lib/catalog';
import { formatDelivery, pickBestToBuy } from '@/lib/recommend';

/**
 * Our pick among the stores selling this exact shoe in this size. It says why, names the alternatives, and is
 * upfront that reviews are not part of it unless a store has a cited rating.
 */
export function BestToBuy({ offers }: { offers: CatalogOffer[] }) {
  const pick = pickBestToBuy(offers);
  if (!pick) return null;
  const { offer } = pick;
  const delivery = formatDelivery(offer);

  return (
    <section aria-labelledby="best-buy-h" className="mb-5 overflow-hidden rounded-3xl border border-[#14213D]/15 bg-white">
      <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-[1fr_auto] md:items-center">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-[#14213D] px-3 py-1 font-mono text-[0.64rem] font-bold uppercase tracking-[0.16em] text-white">
            <Check className="h-3 w-3" aria-hidden /> Best to buy
          </p>
          <h3 id="best-buy-h" className="mt-3 font-display text-[clamp(1.6rem,3vw,2.2rem)] font-bold leading-tight text-text">
            {offer.retailerName}
            <span className="ml-3 font-mono text-[clamp(1.3rem,2.4vw,1.8rem)] font-extrabold tabular-nums">{formatInr(offer.effectivePriceInr as number)}</span>
          </h3>
          <ul className="mt-3 space-y-1.5">
            {pick.reasons.map((r) => (
              <li key={r} className="flex items-start gap-2 text-[0.92rem] text-text-soft">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#2E7D4F]" aria-hidden /> {r}
              </li>
            ))}
          </ul>
          {delivery && offer.deliveryNote && (
            <p className="mt-3 flex items-start gap-2 text-[0.8rem] text-text-faint">
              <Truck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                {offer.deliveryNote}{' '}
                {offer.deliverySourceUrl && (
                  <a href={offer.deliverySourceUrl} target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-text">
                    Store policy
                  </a>
                )}
              </span>
            </p>
          )}
        </div>

        <div className="flex flex-col items-stretch gap-3 md:items-end">
          <a
            href={offer.listingUrl}
            target="_blank"
            rel="nofollow sponsored noopener"
            aria-label={`Buy at ${offer.retailerName} for ${formatInr(offer.effectivePriceInr as number)} (opens in a new tab)`}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#14213D] px-7 font-mono text-[0.76rem] font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-[#0A0A0A]"
          >
            Buy at {offer.retailerName} <ArrowUpRight className="h-4 w-4" aria-hidden />
          </a>
          {pick.alternatives.map((a) => (
            <a
              key={a.offer.retailerSlug}
              href={a.offer.listingUrl}
              target="_blank"
              rel="nofollow sponsored noopener"
              className="text-[0.8rem] text-text-soft underline-offset-2 hover:text-text hover:underline"
            >
              {a.offer.retailerName}: {a.why} ↗
            </a>
          ))}
        </div>
      </div>

      <p className="flex items-start gap-2 border-t border-text/10 bg-[#F6F2EA] px-5 py-3 text-[0.78rem] text-text-soft sm:px-6">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          {pick.usedRatings
            ? 'Chosen on total price, delivery time and store rating.'
            : 'Chosen on total price and delivery time. Reviews are not included yet: these stores do not publish reviews we can read, and we will not make up ratings.'}{' '}
          Compared {pick.competing} {pick.competing === 1 ? 'store' : 'stores'} with this size in stock.
        </span>
      </p>
    </section>
  );
}
