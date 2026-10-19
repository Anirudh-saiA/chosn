import type { Metadata } from 'next';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { FallCard, fetchPriceDrops } from '@/components/search/PriceFalls';

export const metadata: Metadata = {
  title: 'Crazy falls',
  description: 'Sneakers whose price just dropped the most since the previous day, from CHOSN’s recorded price history.',
};

export const revalidate = 600;

export default async function PriceDropsPage() {
  const drops = await fetchPriceDrops(48);
  return (
    <PageShell width="4xl">
      <PageHeader eyebrow="Biggest cuts" title="Crazy falls" />
      <p className="mb-8 max-w-2xl text-[0.98rem] text-text-soft">
        Shoes whose cheapest store lowered its price by 15% or more since the previous day we recorded. These are real recorded cuts, shown
        with the old price. A cheaper store simply appearing does not count as a fall.
      </p>
      {drops.length === 0 ? (
        <p className="rounded-2xl border border-text/10 bg-white p-8 text-center text-text-soft">
          No big falls recorded since yesterday. Check back after the next daily update.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {drops.map((d) => (
            <li key={`${d.styleCode}-${d.size}`}>
              <FallCard d={d} />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-8 text-[0.8rem] text-text-faint">
        Our history is young, so this list grows as more days are recorded. Prices change often: check the store before you buy.
      </p>
    </PageShell>
  );
}
