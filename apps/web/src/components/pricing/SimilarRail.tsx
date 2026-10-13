import Link from 'next/link';
import { CompareToggle } from '@/components/compare/CompareToggle';
import { formatInr, formatSize, type SearchResultItem } from '@/lib/catalog';
import { resolveSneakerImage } from '@/lib/resolve-sneaker-image';

/**
 * "Similar sneakers": other colourways of this shoe and the brand's nearest models, each linking to its own
 * priced page and carrying a compare toggle. A side column on wide screens, a swipeable row below that.
 */
export function SimilarRail({ items, current }: { items: SearchResultItem[]; current: { styleCode: string } }) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="similar-h" className="min-w-0">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">You may also like</p>
          <h2 id="similar-h" className="mt-1.5 font-display text-xl font-bold tracking-tight text-text">
            Similar sneakers
          </h2>
        </div>
        <Link
          href={`/compare?styles=${encodeURIComponent(current.styleCode)},${items
            .slice(0, 2)
            .map((i) => encodeURIComponent(i.styleCode))
            .join(',')}`}
          className="link-underline shrink-0 pb-1 font-mono text-[0.68rem] font-bold uppercase tracking-[0.14em] text-text-soft hover:text-text"
        >
          Compare top 3
        </Link>
      </div>

      <ul className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8 xl:mx-0 xl:flex-col xl:overflow-visible xl:px-0 xl:pb-0">
        {items.map((item) => {
          const image = resolveSneakerImage(item.primaryImageUrl);
          const href = `/sneakers/${encodeURIComponent(item.styleCode)}/${formatSize(item.defaultSize)}`;
          return (
            <li key={item.styleCode} className="relative w-[15.5rem] shrink-0 snap-start xl:w-auto">
              <Link
                href={href}
                className="group flex items-center gap-3 rounded-2xl border border-text/10 bg-white p-2.5 pr-12 transition-colors hover:border-text/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <div className="h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-xl bg-[#EFEBE2]">
                  {image && (
                    <img
                      src={image}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-contain p-1.5 mix-blend-darken transition-transform duration-300 group-hover:scale-105"
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.2em] text-text-faint">{item.brand}</p>
                  <p className="truncate font-display text-[1.02rem] font-semibold uppercase leading-tight text-text">{item.model}</p>
                  <p className="truncate text-[0.78rem] text-text-soft">{item.colorway}</p>
                  {item.bestAvailablePrice !== null && (
                    <p className="mt-0.5 font-mono text-[0.9rem] font-bold tabular-nums text-text">
                      {formatInr(item.bestAvailablePrice)}
                    </p>
                  )}
                </div>
              </Link>
              <CompareToggle
                variant="icon"
                className="absolute right-3 top-1/2 -translate-y-1/2"
                entry={{
                  styleCode: item.styleCode,
                  brand: item.brand,
                  model: item.model,
                  colorway: item.colorway,
                  imageUrl: image,
                }}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
