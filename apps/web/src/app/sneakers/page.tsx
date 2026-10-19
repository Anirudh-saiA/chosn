import type { Metadata } from 'next';
import { CommunityResults } from '@/components/search/CommunityResults';
import { EmptyState } from '@/components/search/EmptyState';
import { BrowseShortcuts } from '@/components/search/BrowseShortcuts';
import { ResultsToolbar } from '@/components/search/ResultsToolbar';
import { SneakerCard } from '@/components/search/SneakerCard';
import { Reveal } from '@/components/fx/Reveal';
import { ScrollHighlight } from '@/components/landing/ScrollHighlight';
import { PageShell } from '@/components/ui/PageShell';
import { fetchSearch, type SearchQuery } from '@/lib/catalog';

export const metadata: Metadata = {
  title: 'Compare sneaker prices',
  description: 'Search and browse the CHOSN launch catalog — compare real-time prices across every tracked retailer.',
};

// Search results churn as fast as the underlying price data (Market
// Intelligence refreshes hourly) — a shorter window than the price
// page's 5 minutes isn't warranted, since a card's price being a few
// minutes behind the live page it links to is unremarkable.
export const revalidate = 300;

interface PageProps {
  searchParams: Promise<SearchQuery>;
}

export default async function SneakersBrowsePage({ searchParams }: PageProps) {
  const query = await searchParams;
  const { q } = query;
  const { results, total, facets, communityPosts, storeDirectory } = await fetchSearch(query, { next: { revalidate: 300 } });
  const stores = Object.fromEntries((storeDirectory ?? []).map((s) => [s.slug, { name: s.name, logoUrl: s.logoUrl }]));

  return (
    <PageShell width="full" plain>
      <header className="mb-6 border-b-2 border-[#0A0A0A] pb-8">
        <Reveal delay={0.05}>
          <h1 className="font-display text-[clamp(4.5rem,15vw,12rem)] uppercase leading-[0.85] tracking-[0.01em] text-[#0A0A0A]">Compare.</h1>
        </Reveal>
        <div className="mt-6">
          <ScrollHighlight
            before="Every pair we track,"
            first="across every retailer"
            between=", shipping included — with the "
            second="best price"
            after="first."
            triggerAt={0.8}
            textClass="max-w-4xl text-[clamp(1.3rem,2.6vw,2.3rem)] leading-[1.25]"
          />
        </div>
      </header>

      <div>
        <div className="min-w-0">
          <ResultsToolbar total={total} facets={facets} />
          {results.length === 0 ? (
            <EmptyState query={q} />
          ) : (
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {results.map((item, i) => (
                <Reveal as="li" key={item.styleCode} delay={(i % 3) * 0.06} y={18}>
                  <SneakerCard item={item} stores={stores} />
                </Reveal>
              ))}
            </ul>
          )}
        </div>
      </div>

      <BrowseShortcuts />

      <CommunityResults posts={communityPosts} />
    </PageShell>
  );
}
