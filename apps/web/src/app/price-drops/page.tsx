import type { Metadata } from 'next';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { DealCard, type Deal } from '@/components/search/DealsTabs';
import { fetchFalls, fetchSale } from '@/components/search/PriceFalls';

export const metadata: Metadata = {
  title: 'Crazy falls',
  description: 'The biggest price cuts on sneakers: recorded falls since yesterday, and discounts against each store\'s own listed price.',
};

export const revalidate = 600;

function Block({ title, intro, deals, empty }: { title: string; intro: string; deals: Deal[]; empty: string }) {
  return (
    <section className="mb-12">
      <h2 className="font-display text-2xl uppercase tracking-[0.02em] text-text">{title}</h2>
      <p className="mb-5 mt-1 max-w-2xl text-[0.92rem] text-text-soft">{intro}</p>
      {deals.length === 0 ? (
        <p className="rounded-2xl border border-text/10 bg-white p-6 text-center text-text-soft">{empty}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {deals.map((d) => (
            <li key={d.key}>
              <DealCard d={d} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function PriceDropsPage() {
  const [falls, sale] = await Promise.all([fetchFalls(48), fetchSale(48)]);
  return (
    <PageShell width="4xl">
      <PageHeader eyebrow="Biggest cuts" title="Crazy falls" />
      <Block
        title="Since yesterday"
        intro="Shoes whose cheapest store lowered its price by 15% or more since the previous day we recorded. These are recorded cuts, shown with the old price. A cheaper store simply appearing does not count."
        deals={falls}
        empty="No big falls recorded since yesterday. Check back after the next daily update."
      />
      <Block
        title="Store sale prices"
        intro={'Discounts of 20% or more against the "was" price the store itself lists. That is the store\'s own claim about its original price, not a price we verified.'}
        deals={sale}
        empty="No store-listed discounts of 20% or more right now."
      />
      <p className="text-[0.8rem] text-text-faint">Our price history is young, so the first list grows as more days are recorded. Prices change often: check the store before you buy.</p>
    </PageShell>
  );
}
