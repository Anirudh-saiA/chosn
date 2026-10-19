import Link from 'next/link';
import { Newspaper } from 'lucide-react';
import { DropLiveProvider } from '@/components/drops/drop-live-context';
import { DropsExplorer } from '@/components/drops/DropsExplorer';
import { SubscriptionsProvider } from '@/components/drops/subscriptions-context';
import { NewsCard } from '@/components/news/NewsCard';
import { NewsFeatureCard } from '@/components/news/NewsFeatureCard';
import { EmptyPanel } from '@/components/ui/EmptyPanel';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { fetchDropsList } from '@/lib/drops';
import { fetchNewsList } from '@/lib/news';

export const revalidate = 300;

const TABS = [
  ['all', 'Everything'],
  ['drops', 'Upcoming drops'],
  ['news', 'News'],
] as const;

/** Drops and News were two pages about the same thing; this is one: pick Upcoming drops, News, or both. */
export default async function ReleasesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: raw } = await searchParams;
  const tab = raw === 'drops' || raw === 'news' ? raw : 'all';
  const [drops, news] = await Promise.all([
    tab === 'news' ? Promise.resolve([]) : fetchDropsList({}, { next: { revalidate: 300 } }),
    tab === 'drops' ? Promise.resolve({ items: [], total: 0 }) : fetchNewsList({ limit: 30 }, { next: { revalidate: 300 } }),
  ]);
  const items = news.items;
  const featureIndex = items.findIndex((i) => i.isBreaking);
  const feature = items.length ? items[featureIndex >= 0 ? featureIndex : 0]! : null;
  const rest = feature ? items.filter((i) => i.id !== feature.id) : [];

  return (
    <PageShell width="7xl">
      <PageHeader
        eyebrow="Releases & news"
        title="What’s coming, and what’s happening."
        description="Real release dates and times, and the coverage around them. Tap the bell on a drop and we’ll remind you."
      />

      <nav aria-label="Filter" className="-mt-4 mb-10 flex flex-wrap gap-2">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={key === 'all' ? '/releases' : `/releases?tab=${key}`}
            aria-current={tab === key ? 'page' : undefined}
            className={`rounded-full border px-5 py-2 text-sm font-semibold ${tab === key ? 'border-[#14213D] bg-[#14213D] text-white' : 'border-text/20 bg-white text-text hover:border-[#14213D]'}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab !== 'news' ? (
        <section aria-labelledby="drops-h">
          <h2 id="drops-h" className="mb-6 font-display text-2xl font-bold text-text">Upcoming drops</h2>
          <DropLiveProvider>
            <SubscriptionsProvider>
              <DropsExplorer drops={drops} />
            </SubscriptionsProvider>
          </DropLiveProvider>
        </section>
      ) : null}

      {tab !== 'drops' ? (
        <section aria-labelledby="news-h" className={tab === 'all' ? 'mt-16' : ''}>
          <h2 id="news-h" className="mb-6 font-display text-2xl font-bold text-text">News</h2>
          {feature ? (
            <>
              <NewsFeatureCard item={feature} />
              {rest.length > 0 ? (
                <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((item, i) => (
                    <NewsCard key={item.id} item={item} index={i} />
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <EmptyPanel icon={<Newspaper className="h-5 w-5" aria-hidden />} title="Nothing posted yet">
              Once a tracked drop goes live, coverage shows up here automatically.
            </EmptyPanel>
          )}
        </section>
      ) : null}
    </PageShell>
  );
}
