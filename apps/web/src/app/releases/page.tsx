import Link from 'next/link';
import { CalendarClock, Newspaper, Sparkles } from 'lucide-react';
import { DropLiveProvider } from '@/components/drops/drop-live-context';
import { DropsExplorer } from '@/components/drops/DropsExplorer';
import { SubscriptionsProvider } from '@/components/drops/subscriptions-context';
import { NewsCard } from '@/components/news/NewsCard';
import { NewsFeatureCard } from '@/components/news/NewsFeatureCard';
import { SneakerCard } from '@/components/search/SneakerCard';
import { EmptyPanel } from '@/components/ui/EmptyPanel';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { fetchSearch, type SearchResponse } from '@/lib/catalog';
import { fetchDropsList } from '@/lib/drops';
import { fetchNewsList } from '@/lib/news';

export const revalidate = 300;

const TABS = [
  ['all', 'Everything'],
  ['landed', 'Just landed'],
  ['drops', 'Upcoming drops'],
  ['news', 'News'],
] as const;

const LANDED_DAYS = 14;

async function loadLanded(limit: number): Promise<SearchResponse | null> {
  try {
    return await fetchSearch({ newDays: String(LANDED_DAYS), sort: 'newest', limit: String(limit) }, { next: { revalidate: 300 } });
  } catch {
    return null;
  }
}

/**
 * Releases: what is new, what is coming, and what is being said, in one place.
 *  - Just landed: shoes a store listed for the first time in the last two weeks (from our own nightly price data, so it is real).
 *  - Upcoming drops: confirmed dates only, each with the source that confirmed it.
 *  - News: our own write-ups and the automatic "is live now" posts.
 */
export default async function ReleasesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: raw } = await searchParams;
  const tab = raw === 'landed' || raw === 'drops' || raw === 'news' ? raw : 'all';
  const [drops, news, landed] = await Promise.all([
    tab === 'news' || tab === 'landed' ? Promise.resolve([]) : fetchDropsList({}, { next: { revalidate: 300 } }),
    tab === 'drops' || tab === 'landed' ? Promise.resolve({ items: [], total: 0 }) : fetchNewsList({ limit: 30 }, { next: { revalidate: 300 } }),
    tab === 'drops' || tab === 'news' ? Promise.resolve(null) : loadLanded(tab === 'landed' ? 24 : 8),
  ]);
  const items = news.items;
  const featureIndex = items.findIndex((i) => i.isBreaking);
  const feature = items.length ? items[featureIndex >= 0 ? featureIndex : 0]! : null;
  const rest = feature ? items.filter((i) => i.id !== feature.id) : [];
  const stores = Object.fromEntries((landed?.storeDirectory ?? []).map((s) => [s.slug, { name: s.name, logoUrl: s.logoUrl }]));

  return (
    <PageShell width="7xl">
      <PageHeader
        eyebrow="Releases & news"
        title="What’s new, what’s coming."
        description="Shoes that just appeared at our stores, drops with a confirmed date and where it was confirmed, and the news around them."
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

      {tab === 'all' || tab === 'landed' ? (
        <section aria-labelledby="landed-h">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="landed-h" className="font-display text-2xl font-bold text-text">Just landed</h2>
              <p className="mt-1 text-sm text-text-soft">New at a store in the last {LANDED_DAYS} days, newest first.</p>
            </div>
            {landed && landed.total > 0 ? (
              <Link href={`/sneakers?newDays=${LANDED_DAYS}&sort=newest`} className="font-mono text-[0.72rem] font-bold uppercase tracking-[0.14em] text-text underline underline-offset-4">
                See all {landed.total.toLocaleString('en-IN')} on Compare
              </Link>
            ) : null}
          </div>
          {landed && landed.results.length > 0 ? (
            <ul className="grid grid-cols-2 gap-2.5 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
              {landed.results.map((item) => (
                <li key={item.styleCode}>
                  <SneakerCard item={item} stores={stores} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyPanel icon={<Sparkles className="h-5 w-5" aria-hidden />} title="Nothing new yet">
              We note the day a store first lists a shoe, after each nightly update. New arrivals show up here from the next few updates.
            </EmptyPanel>
          )}
        </section>
      ) : null}

      {tab === 'all' || tab === 'drops' ? (
        <section aria-labelledby="drops-h" className={tab === 'all' ? 'mt-16' : ''}>
          <h2 id="drops-h" className="mb-6 font-display text-2xl font-bold text-text">Upcoming drops</h2>
          {drops.length > 0 ? (
            <DropLiveProvider>
              <SubscriptionsProvider>
                <DropsExplorer drops={drops} />
              </SubscriptionsProvider>
            </DropLiveProvider>
          ) : (
            <EmptyPanel icon={<CalendarClock className="h-5 w-5" aria-hidden />} title="No confirmed drops right now">
              We list a drop only when a brand or retailer has confirmed its date, and we show who confirmed it. Check back soon.
            </EmptyPanel>
          )}
        </section>
      ) : null}

      {tab === 'all' || tab === 'news' ? (
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
