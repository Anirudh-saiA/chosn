import type { Metadata } from 'next';
import { Masthead } from '@/components/Masthead';
import { EmptyState } from '@/components/search/EmptyState';
import { SearchControls } from '@/components/search/SearchControls';
import { SneakerCard } from '@/components/search/SneakerCard';
import { fetchSearch } from '@/lib/catalog';

export const metadata: Metadata = {
  title: 'Search sneakers | CHOSN',
  description: 'Search and browse the CHOSN launch catalog — compare real-time prices across every tracked retailer.',
};

// Search results churn as fast as the underlying price data (Market
// Intelligence refreshes hourly) — a shorter window than the price
// page's 5 minutes isn't warranted, since a card's price being a few
// minutes behind the live page it links to is unremarkable.
export const revalidate = 300;

interface PageProps {
  searchParams: Promise<{ q?: string; brand?: string; signal?: string }>;
}

export default async function SneakersBrowsePage({ searchParams }: PageProps) {
  const { q, brand, signal } = await searchParams;
  const { results, total, brands } = await fetchSearch(
    { q, brand, signal },
    { next: { revalidate: 300 } },
  );

  return (
    <main>
      <Masthead />
      <div className="mx-auto max-w-6xl px-6 py-10 lg:py-12">
        <header className="mb-8 max-w-[60ch]">
          <h1 className="font-display text-display-section font-semibold text-text">
            Search sneakers
          </h1>
          <p className="mt-2 text-body text-text-soft">
            {total} {total === 1 ? 'sneaker' : 'sneakers'} tracked across every retailer CHOSN
            compares.
          </p>
        </header>

        <SearchControls brands={brands} />

        <div className="mt-8">
          {results.length === 0 ? (
            <EmptyState query={q} />
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {results.map((item) => (
                <SneakerCard key={item.styleCode} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
