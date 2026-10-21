import Link from 'next/link';
import { Newspaper, Sparkles } from 'lucide-react';
import { DropLiveProvider } from '@/components/drops/drop-live-context';
import { NewsFront } from '@/components/news/NewsFront';
import { ScrollHighlight } from '@/components/landing/ScrollHighlight';
import { DropsExplorer } from '@/components/drops/DropsExplorer';
import { SubscriptionsProvider } from '@/components/drops/subscriptions-context';
import { ReleasesExperience } from '@/components/releases/ReleasesExperience';
import { SneakerCard } from '@/components/search/SneakerCard';
import { EmptyPanel } from '@/components/ui/EmptyPanel';
import { CompareTray } from '@/components/compare/CompareTray';
import { Masthead } from '@/components/Masthead';
import { SiteFooter } from '@/components/SiteFooter';
import { fetchSearch, type SearchResponse } from '@/lib/catalog';
import { fetchDropsList } from '@/lib/drops';
import { fetchNewsList } from '@/lib/news';

// The news list is read fresh on every visit (cache: no-store below), so a story that came online a minute ago is already here; drops and the landed list keep short caches.

const LANDED_DAYS = 14;
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function loadLanded(): Promise<SearchResponse | null> {
  try {
    return await fetchSearch({ newDays: String(LANDED_DAYS), sort: 'newest', limit: '8' }, { next: { revalidate: 300 } });
  } catch {
    return null;
  }
}

/**
 * Releases: a gateway with Drops on the left and News on the right (ReleasesExperience). Both sections are built here on the server.
 *  - Drops: a calendar and the list of confirmed upcoming drops (each with the source that confirmed it), then shoes that just landed.
 *  - News: our own write-ups and the automatic "is live now" posts.
 */
export default async function ReleasesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const initial = tab === 'drops' || tab === 'landed' ? 'drops' : tab === 'news' ? 'news' : 'gate';
  const [drops, top, web, landed] = await Promise.all([
    fetchDropsList({}, { next: { revalidate: 300 } }),
    fetchNewsList({ limit: 47, sort: 'relevance' }, { cache: 'no-store' }),
    fetchNewsList({ limit: 1, external: '1' }, { next: { revalidate: 300 } }),
    loadLanded(),
  ]);
  const webSources = web.sources ?? [];
  const stores = Object.fromEntries((landed?.storeDirectory ?? []).map((s) => [s.slug, { name: s.name, logoUrl: s.logoUrl }]));

  const dropsView = (
    <div className="flex flex-col gap-16">
      <section aria-labelledby="drops-h">
        <h2 id="drops-h" className="font-display text-[clamp(2.5rem,6vw,4.5rem)] uppercase leading-[0.95] text-[#0A0A0A]">Drop calendar</h2>
        <div className="mb-6 mt-3">
          <ScrollHighlight
            before="Release dates from brands, retailers and trackers. Every drop says"
            first="how firm its date is"
            between=" and "
            second="where it came from"
            after="— US drops are priced in US dollars."
            textClass="max-w-3xl text-[clamp(1.2rem,2.3vw,1.75rem)] leading-[1.4]"
            triggerAt={0.9}
          />
        </div>
        <p className="mb-6 flex flex-wrap items-center gap-3 text-sm">
          <a href={`${API_URL}/drops/calendar.ics`} className="inline-flex items-center gap-2 rounded-full bg-[#14213D] px-5 py-2.5 font-display text-base uppercase tracking-[0.06em] text-white">
            Add every drop to your calendar
          </a>
          <span className="text-text-soft">Downloads a calendar file (.ics) that opens in Google, Apple or Outlook calendar.</span>
        </p>
        <DropLiveProvider>
          <SubscriptionsProvider>
            <DropsExplorer drops={drops} />
          </SubscriptionsProvider>
        </DropLiveProvider>
      </section>

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
    </div>
  );

  const newsView = (
    <section aria-labelledby="news-h">
      <h2 id="news-h" className="sr-only">News</h2>
      {top.items.length > 0 ? (
        <NewsFront items={top.items} sourceCount={webSources.length + 1} />
      ) : (
        <EmptyPanel icon={<Newspaper className="h-5 w-5" aria-hidden />} title="No stories yet">
          The nightly update gathers sneaker and fashion headlines from public feeds.
        </EmptyPanel>
      )}
    </section>
  );

  return (
    <div className="page-shell relative">
      <div className="relative z-10">
        <Masthead />
        <main id="main">
          <ReleasesExperience initial={initial} drops={dropsView} news={newsView} footer={<SiteFooter />} />
        </main>
      </div>
      <CompareTray />
    </div>
  );
}
