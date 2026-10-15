import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { CompareToggle } from '@/components/compare/CompareToggle';
import { ShoePhoto } from '@/components/ui/ShoePhoto';
import { formatInr, formatSize, type SearchResultItem } from '@/lib/catalog';
import { resolveSneakerImage } from '@/lib/resolve-sneaker-image';

function ShoeTile({ item }: { item: SearchResultItem }) {
  const image = resolveSneakerImage(item.primaryImageUrl);
  const details = `/sneakers/${encodeURIComponent(item.styleCode)}/${formatSize(item.defaultSize)}`;
  return (
    <li className="group relative flex flex-col overflow-hidden rounded-2xl border border-text/10 bg-white transition-colors hover:border-text/40">
      <Link href={details} className="relative block aspect-square bg-white focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2" aria-label={`${item.brand} ${item.model}, ${item.colorway}`}>
        {image && (
          <ShoePhoto
            key={image}
            src={image}
            alt=""
            className="absolute inset-0 h-full w-full object-contain p-5 transition-transform duration-500 group-hover:scale-[1.04]"
          />
        )}
      </Link>
      <CompareToggle
        variant="icon"
        className="absolute right-3 top-3"
        entry={{ styleCode: item.styleCode, brand: item.brand, model: item.model, colorway: item.colorway, imageUrl: image }}
      />
      <div className="flex flex-1 flex-col gap-1 p-4 pt-3">
        <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.2em] text-text-faint">{item.brand}</p>
        <Link href={details} className="font-display text-[1.15rem] font-semibold uppercase leading-tight text-text hover:underline">
          {item.model}
        </Link>
        <p className="line-clamp-1 text-[0.82rem] text-text-soft">{item.colorway}</p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <div>
            <p className="font-mono text-[1.1rem] font-extrabold tabular-nums text-text">{formatInr(item.bestAvailablePrice ?? 0)}</p>
            {item.bestRetailerName && <p className="text-[0.72rem] text-text-soft">at {item.bestRetailerName}</p>}
          </div>
          {item.listingUrl && (
            <a
              href={item.listingUrl}
              target="_blank"
              rel="nofollow sponsored noopener"
              aria-label={`View deal for ${item.model} ${item.colorway} at ${item.bestRetailerName ?? 'the store'} (opens in a new tab)`}
              className="inline-flex min-h-[38px] items-center gap-1 rounded-full bg-[#14213D] px-3.5 font-mono text-[0.68rem] font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-[#0A0A0A]"
            >
              View deal <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

function Group({ id, eyebrow, title, items }: { id: string; eyebrow: string; title: string; items: SearchResultItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={id}>
      <div className="mb-5">
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={id} className="mt-2 font-display text-2xl font-bold tracking-tight text-text sm:text-3xl">
          {title}
        </h2>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        {items.map((item) => (
          <ShoeTile key={item.styleCode} item={item} />
        ))}
      </ul>
    </section>
  );
}

/**
 * Bottom of the product page: other colours of this same model, then related sneakers — each with its cheapest
 * in-stock store and a direct "View deal" link, so a shopper can jump straight to a store from here.
 */
export function MoreLikeThis({ items }: { items: SearchResultItem[] }) {
  const sameModel = items.filter((i) => i.sameModel).slice(0, 5);
  const related = items.filter((i) => !i.sameModel).slice(0, 5);
  if (sameModel.length === 0 && related.length === 0) return null;
  return (
    <div className="flex flex-col gap-12">
      <Group id="colours-h" eyebrow="Same shoe" title="Other colours" items={sameModel} />
      <Group id="related-h" eyebrow="Keep looking" title="Related sneakers" items={related} />
    </div>
  );
}
