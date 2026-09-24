import type { Metadata } from 'next';
import { Newspaper } from 'lucide-react';
import { NewsCard } from '@/components/news/NewsCard';
import { NewsFeatureCard } from '@/components/news/NewsFeatureCard';
import { EmptyPanel } from '@/components/ui/EmptyPanel';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { fetchNewsList } from '@/lib/news';

export const metadata: Metadata = {
  title: 'News',
  description: "Drop announcements and coverage from CHOSN's editorial team, the moment they happen.",
};

export const revalidate = 300;

export default async function NewsPage() {
  const { items } = await fetchNewsList({ limit: 30 }, { next: { revalidate: 300 } });

  const header = (
    <PageHeader
      eyebrow="Magazine"
      title="News"
      description="What's actually happening, not what's rumored — structured facts plus original CHOSN write-ups, per our own sourcing rules."
    />
  );

  if (items.length === 0) {
    return (
      <PageShell width="7xl">
        {header}
        <EmptyPanel icon={<Newspaper className="h-5 w-5" aria-hidden />} title="Nothing posted yet">
          Once a tracked drop goes live, coverage shows up here automatically.
        </EmptyPanel>
      </PageShell>
    );
  }

  // The top feature: the single most recent breaking story, or just the
  // newest item if nothing's currently breaking — either way, exactly
  // one feature slot, never zero and never more than one competing for
  // "the" prominent position.
  const featureIndex = items.findIndex((i) => i.isBreaking);
  const feature = items[featureIndex >= 0 ? featureIndex : 0]!;
  const rest = items.filter((i) => i.id !== feature.id);

  return (
    <PageShell width="7xl">
      {header}

      <NewsFeatureCard item={feature} />

      {rest.length > 0 && (
        <>
          <div className="mb-6 mt-16 flex items-center gap-4">
            <h2 className="font-display text-2xl font-bold text-text">Latest coverage</h2>
            <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-text/15 to-transparent" />
          </div>
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((item, i) => (
              <NewsCard key={item.id} item={item} index={i} />
            ))}
          </ul>
        </>
      )}
    </PageShell>
  );
}
