import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, Flame, MessageSquare, Plus, ShieldCheck, TrendingDown } from 'lucide-react';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { FeedList } from '@/components/community/FeedList';
import { buttonVariantClass } from '@chosn/ui';
import { auth } from '@/auth';
import { listPosts } from '@/lib/community';

export const metadata: Metadata = {
  title: 'Community',
  description: 'Price Check, Cop or Drop, Legit Check and Drop Talk — the CHOSN community feed.',
};

const PILLARS = [
  { icon: TrendingDown, title: 'Price check', body: 'Is this price fair right now?' },
  { icon: Flame, title: 'Cop or drop', body: 'Put a pair to a vote.' },
  { icon: ShieldCheck, title: 'Legit check', body: 'Second eyes on the details.' },
  { icon: MessageSquare, title: 'Drop talk', body: 'Live chat while a drop runs.' },
];

/**
 * Public read (task 4) — the feed itself doesn't require sign-in, only
 * posting/voting does. `auth()` still runs here so a signed-in viewer's
 * own votes/poll picks render correctly on first load rather than
 * flashing in after a client refetch.
 */
export default async function CommunityFeedPage() {
  const session = await auth();
  const apiToken = (session as unknown as { apiToken?: string } | null)?.apiToken;

  const posts = await listPosts({ limit: 30 }, apiToken);

  return (
    <PageShell width="6xl">
      <PageHeader
        eyebrow="Community"
        title={
          <>
            The <span className="text-brass-gradient">feed.</span>
          </>
        }
        description="Real collectors on real decisions. CHOSN never sells anything here — this is discussion, not a marketplace."
      >
        {apiToken ? (
          <Link href="/community/new" className={buttonVariantClass('primary')}>
            <Plus className="h-4 w-4" aria-hidden /> New post
          </Link>
        ) : (
          <Link href="/login" className={buttonVariantClass('secondary')}>
            Sign in to post
          </Link>
        )}
      </PageHeader>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <FeedList posts={posts} signedIn={!!apiToken} />

        <aside className="hidden lg:block">
          <div className="sticky top-24 flex flex-col gap-5">
            <section className="panel ticks p-5" aria-labelledby="how-h">
              <h2 id="how-h" className="eyebrow">
                What lives here
              </h2>
              <ul className="mt-4 flex flex-col gap-4">
                {PILLARS.map((p) => (
                  <li key={p.title} className="flex gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-brass/30 bg-brass/[0.07] text-brass-bright">
                      <p.icon className="h-4 w-4" aria-hidden />
                    </span>
                    <div>
                      <p className="font-display text-base font-semibold text-text">{p.title}</p>
                      <p className="text-meta text-text-soft">{p.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
            <Link
              href="/community-guidelines"
              className="panel flex items-center gap-3 p-4 text-ui-label font-semibold text-text-soft transition-colors hover:text-brass-bright"
            >
              <BookOpen className="h-4 w-4 text-brass" aria-hidden />
              Community guidelines
            </Link>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
