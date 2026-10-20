import { SneakerCard, type StoreInfo } from '@/components/search/SneakerCard';
import type { SearchResultItem } from '@/lib/catalog';

function Group({ id, eyebrow, title, items, stores }: { id: string; eyebrow: string; title: string; items: SearchResultItem[]; stores: Record<string, StoreInfo> }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={id}>
      <div className="mb-5">
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={id} className="mt-2 font-display text-2xl font-bold tracking-tight text-text sm:text-3xl">
          {title}
        </h2>
      </div>
      <ul className="grid grid-cols-2 gap-2.5 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <li key={item.styleCode}>
            <SneakerCard item={item} stores={stores} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Bottom of the product page: related sneakers (other models), each as the same card the Compare page uses: logo, colours, sizes,
 * every store's price and the Buy now / Wait call. A card gets its sizes and store prices when it arrives.
 */
export function MoreLikeThis({ items, stores = {} }: { items: SearchResultItem[]; stores?: Record<string, StoreInfo> }) {
  // Other colours of this same model live in the colour picker under the name, so only different models are shown here.
  const related = items.filter((i) => !i.sameModel).slice(0, 8);
  if (related.length === 0) return null;
  return <Group id="related-h" eyebrow="Keep looking" title="Related sneakers" items={related} stores={stores} />;
}
