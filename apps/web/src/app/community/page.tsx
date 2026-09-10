import type { Metadata } from 'next';
import Link from 'next/link';
import { Masthead } from '@/components/Masthead';
import { SiteFooter } from '@/components/SiteFooter';
import { PostCard } from '@/components/community/PostCard';
import { buttonVariantClass } from '@chosn/ui';
import { auth } from '@/auth';
import { listPosts } from '@/lib/community';

export const metadata: Metadata = {
  title: 'Community | CHOSN',
  description: 'Price Check, Cop or Drop, Legit Check, and Drop Talk — the CHOSN community feed.',
};

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
    <main>
      <Masthead />
      <div className="mx-auto max-w-2xl px-6 py-10 lg:py-14">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-ui-label uppercase tracking-[0.06em] text-text-faint">Community</p>
            <h1 className="mt-1 font-display text-display-section font-semibold text-text">The feed</h1>
          </div>
          {apiToken ? (
            <Link href="/community/new" className={buttonVariantClass('primary')}>
              New post
            </Link>
          ) : (
            <Link href="/login" className={buttonVariantClass('secondary')}>
              Sign in to post
            </Link>
          )}
        </div>

        <p className="mt-4 max-w-[65ch] text-body text-text-soft">
          Price Check, Cop or Drop, Legit Check, and Drop Talk — real collectors on real decisions. CHOSN never sells
          anything here; this is discussion, not a marketplace.
        </p>

        <div className="mt-8 flex flex-col gap-5">
          {posts.length === 0 ? (
            <p className="text-body text-text-faint">Nothing posted yet — be the first.</p>
          ) : (
            posts.map((post) => <PostCard key={post.id} post={post} />)
          )}
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
