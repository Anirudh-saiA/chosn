import type { Metadata } from 'next';
import { CommunityResults } from '@/components/search/CommunityResults';
import { EmptyState } from '@/components/search/EmptyState';
import { SearchControls } from '@/components/search/SearchControls';
import { SneakerCard } from '@/components/search/SneakerCard';
import { CountUp } from '@/components/fx/CountUp';
import { Reveal } from '@/components/fx/Reveal';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { fetchSearch } from '@/lib/catalog';

export const metadata: Metadata = {
  title: 'Search sneakers',
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
  const { results, total, brands, communityPosts } = await fetchSearch(
    { q, brand, signal },
    { next: { revalidate: 300 } },
  );

  return (
    <PageShell width="7xl">
      <PageHeader
        eyebrow="Catalog / Live prices"
        title="Search sneakers"
        description="Every pair we track, compared across every retailer CHOSN watches."
        className="!mb-8 lg:!mb-10"
      >
        <p className="flex items-baseline gap-2 border border-text/[0.1] bg-vault-raised/60 px-4 py-2.5" aria-live="polite">
          <span className="live-dot" aria-hidden />
          <span className="font-mono text-2xl font-medium tabular-nums text-brass-bright">
            <CountUp to={total} duration={0.9} />
          </span>
          <span className="font-mono text-meta uppercase tracking-[0.12em] text-text-soft">
            {total === 1 ? 'sneaker' : 'sneakers'} tracked
          </span>
        </p>
      </PageHeader>

      <SearchControls brands={brands} />

      <div className="mt-8">
        {results.length === 0 ? (
          <EmptyState query={q} />
        ) : (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {results.map((item, i) => (
              <Reveal as="li" key={item.styleCode} delay={(i % 4) * 0.06} y={18}>
                <SneakerCard item={item} />
              </Reveal>
            ))}
          </ul>
        )}
      </div>

      <CommunityResults posts={communityPosts} />
    </PageShell>
  );
}
