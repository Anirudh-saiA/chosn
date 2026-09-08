import type { Metadata } from 'next';
import { Masthead } from '@/components/Masthead';
import { NewsCard } from '@/components/news/NewsCard';
import { NewsFeatureCard } from '@/components/news/NewsFeatureCard';
import { fetchNewsList } from '@/lib/news';

export const metadata: Metadata = {
  title: 'News | CHOSN',
  description: "Drop announcements and coverage from CHOSN's editorial team, the moment they happen.",
};

export const revalidate = 300;

export default async function NewsPage() {
  const { items } = await fetchNewsList({ limit: 30 }, { next: { revalidate: 300 } });

  if (items.length === 0) {
    return (
      <main>
        <Masthead />
        <div className="mx-auto max-w-4xl px-6 py-10 lg:py-14">
          <Header />
          <p className="py-12 text-center text-body text-text-soft">
            Nothing posted yet — once a tracked drop goes live, coverage
            shows up here automatically.
          </p>
        </div>
      </main>
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
    <main>
      <Masthead />
      <div className="mx-auto max-w-4xl px-6 py-10 lg:py-14">
        <Header />

        <NewsFeatureCard item={feature} />

        {rest.length > 0 && (
          <ul className="mt-10 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2">
            {rest.map((item) => (
              <li key={item.id}>
                <NewsCard item={item} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function Header() {
  return (
    <header className="mb-10">
      <p className="font-mono text-meta uppercase tracking-[0.08em] text-brass">Magazine</p>
      <h1 className="mt-1 font-display text-display-hero font-semibold leading-[1.05] text-text">News</h1>
      <p className="mt-3 max-w-[60ch] text-body text-text-soft">
        What's actually happening, not what's rumored — structured facts
        plus original CHOSN write-ups, per our own sourcing rules.
      </p>
    </header>
  );
}
