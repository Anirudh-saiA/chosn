import Link from 'next/link';
import { ArrowUpRight, Check, X } from 'lucide-react';
import { formatInr, formatSize, type CompareItem } from '@/lib/catalog';
import { resolveSneakerImage } from '@/lib/resolve-sneaker-image';

const LABEL = 'font-mono text-[0.66rem] font-bold uppercase tracking-[0.18em] text-text-faint';
const CELL = 'border-t border-text/10 px-4 py-4';

function withoutShoe(items: CompareItem[], styleCode: string) {
  const rest = items.filter((i) => i.styleCode !== styleCode).map((i) => encodeURIComponent(i.styleCode));
  return rest.length > 0 ? `/compare?styles=${rest.join(',')}` : '/compare';
}

/** Side-by-side: one column per shoe, one row per store, the cheapest price in each row marked. */
export function CompareView({ items }: { items: CompareItem[] }) {
  const cols = `9.5rem repeat(${items.length}, minmax(0, 1fr))`;
  const minWidth = `${9.5 + items.length * 17.5}rem`; // below this the table scrolls sideways instead of squeezing
  const lowestOverall = Math.min(...items.map((i) => i.bestPrice ?? Infinity));

  // Every store that lists at least one of the shoes, the most widely stocked first.
  const stores = new Map<string, { name: string; count: number }>();
  for (const item of items) {
    for (const o of item.offers) {
      const entry = stores.get(o.retailerSlug) ?? { name: o.retailerName, count: 0 };
      entry.count += 1;
      stores.set(o.retailerSlug, entry);
    }
  }
  const storeRows = [...stores.entries()].sort((a, b) => b[1].count - a[1].count || a[1].name.localeCompare(b[1].name));

  return (
    <div className="overflow-x-auto rounded-3xl border border-text/10 bg-white">
      <div className="grid" style={{ gridTemplateColumns: cols, minWidth }}>
        {/* Shoes */}
        <div className="p-4" aria-hidden />
        {items.map((item) => {
          const image = resolveSneakerImage(item.primaryImageUrl);
          const href = item.linkSize !== null ? `/sneakers/${encodeURIComponent(item.styleCode)}/${formatSize(item.linkSize)}` : null;
          return (
            <div key={item.styleCode} className="relative p-4">
              <Link
                href={withoutShoe(items, item.styleCode)}
                aria-label={`Remove ${item.brand} ${item.model} from the comparison`}
                className="absolute right-6 top-6 z-10 grid h-8 w-8 place-items-center rounded-full border border-text/15 bg-white text-text-soft transition-colors hover:border-text hover:text-text"
              >
                <X className="h-4 w-4" aria-hidden />
              </Link>
              <div className="relative aspect-square overflow-hidden rounded-2xl bg-white">
                {image ? (
                  <img referrerPolicy="no-referrer" src={image} alt={`${item.brand} ${item.model} ${item.colorway}`} className="absolute inset-0 h-full w-full object-contain p-6" />
                ) : (
                  <div className="grid h-full w-full place-items-center font-mono text-xs text-text-faint">No photo</div>
                )}
              </div>
              <p className="mt-4 font-mono text-[0.62rem] font-bold uppercase tracking-[0.2em] text-text-faint">{item.brand}</p>
              <h2 className="mt-1 font-display text-[1.45rem] font-bold uppercase leading-[1.05] text-text">{item.model}</h2>
              <p className="mt-1 line-clamp-2 text-[0.88rem] text-text-soft">{item.colorway}</p>
              <p className="mt-2 font-mono text-[0.68rem] text-text-faint">{item.styleCode}</p>
              {href && (
                <Link href={href} className="link-underline mt-3 inline-flex items-center gap-1 font-mono text-[0.7rem] font-bold uppercase tracking-[0.14em] text-text">
                  Full price page <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              )}
            </div>
          );
        })}

        {/* Best price */}
        <div className={`${CELL} ${LABEL}`}>Best price</div>
        {items.map((item) => {
          const isLowest = item.bestPrice !== null && item.bestPrice === lowestOverall && items.length > 1;
          const diff = item.bestPrice !== null && Number.isFinite(lowestOverall) ? item.bestPrice - lowestOverall : 0;
          return (
            <div key={item.styleCode} className={CELL}>
              {item.bestPrice !== null ? (
                <>
                  <p className="font-mono text-[1.7rem] font-extrabold leading-none tabular-nums text-text">{formatInr(item.bestPrice)}</p>
                  <p className="mt-1.5 text-[0.82rem] text-text-soft">at {item.bestRetailerName}</p>
                  {isLowest ? (
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#0A0A0A] px-2.5 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-white">
                      <Check className="h-3 w-3" aria-hidden /> Lowest
                    </span>
                  ) : diff > 0 ? (
                    <p className="mt-2 font-mono text-[0.78rem] font-semibold text-[#B4452A]">+{formatInr(diff)} vs lowest</p>
                  ) : null}
                </>
              ) : (
                <p className="font-mono text-sm font-semibold text-text-faint">Unavailable</p>
              )}
            </div>
          );
        })}

        {/* Stores */}
        <div className={`${CELL} ${LABEL}`}>Stores in stock</div>
        {items.map((item) => (
          <div key={item.styleCode} className={`${CELL} font-mono text-[1rem] font-bold tabular-nums text-text`}>
            {item.offers.length}
          </div>
        ))}

        {/* One row per store */}
        {storeRows.map(([slug, store]) => {
          const prices = items.map((i) => i.offers.find((o) => o.retailerSlug === slug));
          const rowMin = Math.min(...prices.map((o) => o?.bestPrice ?? Infinity));
          return (
            <div key={slug} className="contents">
              <div className={`${CELL} text-[0.9rem] font-semibold text-text`}>{store.name}</div>
              {prices.map((offer, i) => (
                <div key={items[i]!.styleCode} className={CELL}>
                  {offer ? (
                    <a
                      href={offer.listingUrl}
                      target="_blank"
                      rel="nofollow sponsored noopener"
                      aria-label={`Open ${items[i]!.model} at ${store.name} (opens in a new tab)`}
                      className={`group inline-flex items-center gap-1.5 font-mono tabular-nums transition-colors hover:text-text ${
                        offer.bestPrice === rowMin && prices.filter(Boolean).length > 1 ? 'text-[1.05rem] font-extrabold text-text' : 'text-[0.98rem] font-medium text-text-soft'
                      }`}
                    >
                      {formatInr(offer.bestPrice)}
                      {offer.bestPrice === rowMin && prices.filter(Boolean).length > 1 && <Check className="h-3.5 w-3.5 text-[#2E7D4F]" aria-label="cheapest here" />}
                      <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                    </a>
                  ) : (
                    <span className="font-mono text-text-faint">—</span>
                  )}
                </div>
              ))}
            </div>
          );
        })}

        {/* Sizes */}
        <div className={`${CELL} ${LABEL}`}>UK sizes in stock</div>
        {items.map((item) => (
          <div key={item.styleCode} className={CELL}>
            {item.sizesInStock.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5">
                {item.sizesInStock.map((size) => (
                  <li key={size} className="rounded-md border border-text/15 px-2 py-0.5 font-mono text-[0.74rem] tabular-nums text-text-soft">
                    {formatSize(size)}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="font-mono text-text-faint">—</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
