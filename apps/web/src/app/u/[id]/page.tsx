import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { AvatarIdenticon } from '@/components/AvatarIdenticon';
import { Masthead } from '@/components/Masthead';
import { SiteFooter } from '@/components/SiteFooter';
import { NotificationSettings } from '@/components/community/NotificationSettings';
import { ReputationBadge } from '@/components/community/ReputationBadge';
import { getUserActivity } from '@/lib/community';
import { getPublicProfile } from '@/lib/reputation';

const POST_TYPE_LABEL: Record<string, string> = {
  price_check: 'Price Check',
  cop_or_drop: 'Cop or Drop',
  legit_check: 'Legit Check',
  drop_talk: 'Drop Talk',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const profile = await getPublicProfile(id);
  if (!profile) return { title: 'Not found | CHOSN' };
  return { title: `${profile.user.displayName ?? 'Collector'} | CHOSN` };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Day 23 shipped identity + the reputation breakdown. Day 24 (task 3)
 * adds the other two pieces the brief asks for: a real activity feed
 * (their own posts/comments — see lib/community.ts's `getUserActivity`,
 * one round trip against the new `/community/activity/:userId`
 * endpoint) and, only when this is the signed-in viewer's own profile,
 * their notification settings. The own-profile check is a plain id
 * comparison against `auth()`'s session — the actual security boundary
 * for anything that check gates (reading/changing notification
 * preferences) is still `ApiAuthGuard` server-side on every one of
 * those calls, this is just what decides whether to render the section
 * at all.
 */
export default async function ProfilePage({ params }: PageProps) {
  const { id } = await params;
  const [profile, activity, session] = await Promise.all([getPublicProfile(id), getUserActivity(id), auth()]);
  if (!profile) notFound();

  const { reputation, user } = profile;
  const viewerId = (session?.user as unknown as { id?: string } | undefined)?.id;
  const apiToken = (session as unknown as { apiToken?: string } | null)?.apiToken;
  const isOwnProfile = viewerId === id;

  return (
    <main>
      <Masthead />
      <div className="mx-auto max-w-2xl px-6 py-10 lg:py-14">
        <header className="flex items-center gap-4">
          <AvatarIdenticon seed={user.avatarSeed} size={56} />
          <div>
            <h1 className="font-display text-display-section font-semibold text-text">
              {user.displayName ?? `Collector ${id.slice(0, 4)}`}
            </h1>
            <p className="mt-1 flex items-center gap-2 font-mono text-meta text-text-faint">
              Member since {formatDate(reputation.accountCreatedAt)}
              <ReputationBadge score={reputation.score} />
            </p>
          </div>
        </header>

        <section className="mt-10 border border-moss/20 bg-vault-raised p-6">
          <h2 className="font-mono text-ui-label font-semibold uppercase tracking-[0.06em] text-text-faint">
            Reputation breakdown
          </h2>
          <p className="mt-1 max-w-[60ch] text-meta text-text-faint">
            Transparent by design — v1 is a sum of named points, not a black box. See{' '}
            <a href="/community-guidelines" className="underline hover:text-text">
              Community Guidelines
            </a>{' '}
            for how this is used.
          </p>

          <dl className="mt-5 flex flex-col divide-y divide-moss/15">
            <div className="flex items-center justify-between py-3">
              <dt className="text-body text-text">Account age</dt>
              <dd className="font-mono text-body text-text-soft">{reputation.accountAgePoints} pts</dd>
            </div>
            <div className="flex items-center justify-between py-3">
              <dt className="text-body text-text">
                Helpful votes received <span className="text-meta text-text-faint">({reputation.helpfulVotesReceived})</span>
              </dt>
              <dd className="font-mono text-body text-text-soft">{reputation.helpfulVotePoints} pts</dd>
            </div>
            <div className="flex items-center justify-between py-3">
              <dt className="text-body text-text">
                Verified purchases <span className="text-meta text-text-faint">({reputation.verifiedPurchaseCount})</span>
              </dt>
              <dd className="font-mono text-body text-text-soft">{reputation.verifiedPurchasePoints} pts</dd>
            </div>
            <div className="flex items-center justify-between pt-3 font-semibold">
              <dt className="text-body text-text">Total</dt>
              <dd className="font-mono text-body text-brass">{reputation.score} pts</dd>
            </div>
          </dl>

          {reputation.verifiedPurchaseCount === 0 && (
            <p className="mt-4 border-t border-moss/15 pt-4 text-meta text-text-faint">
              Verified purchases aren't tracked yet — CHOSN doesn't process purchases (it's price intelligence, not a
              marketplace), so this stays a placeholder, ready to activate once a real verification signal exists.
            </p>
          )}
        </section>

        <section className="mt-10">
          <h2 className="font-mono text-ui-label font-semibold uppercase tracking-[0.06em] text-text-faint">
            Activity
          </h2>
          {activity.posts.length === 0 && activity.comments.length === 0 ? (
            <p className="mt-3 text-meta text-text-faint">No posts or comments yet.</p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-moss/15 border-y border-moss/15">
              {[
                ...activity.posts.map((post) => ({ kind: 'post' as const, item: post, createdAt: post.createdAt })),
                ...activity.comments.map((comment) => ({ kind: 'comment' as const, item: comment, createdAt: comment.createdAt })),
              ]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((entry) =>
                  entry.kind === 'post' ? (
                    <li key={`post-${entry.item.id}`} className="py-3">
                      <Link href={`/community/${entry.item.id}`} className="flex flex-col gap-0.5 hover:text-brass">
                        <span className="font-mono text-meta uppercase tracking-[0.06em] text-brass">
                          {POST_TYPE_LABEL[entry.item.postType] ?? entry.item.postType} · posted
                        </span>
                        <span className="text-body text-text">{entry.item.title ?? entry.item.body ?? '(untitled)'}</span>
                      </Link>
                    </li>
                  ) : (
                    <li key={`comment-${entry.item.id}`} className="py-3">
                      <Link href={`/community/${entry.item.postId}`} className="flex flex-col gap-0.5 hover:text-brass">
                        <span className="font-mono text-meta uppercase tracking-[0.06em] text-text-faint">
                          commented on {entry.item.postTitle ?? 'a post'}
                        </span>
                        <span className="text-body text-text">{entry.item.body}</span>
                      </Link>
                    </li>
                  ),
                )}
            </ul>
          )}
        </section>

        {isOwnProfile && apiToken && <NotificationSettings apiToken={apiToken} />}
      </div>
      <SiteFooter />
    </main>
  );
}
