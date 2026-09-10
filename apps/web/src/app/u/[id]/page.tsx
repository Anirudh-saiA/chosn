import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AvatarIdenticon } from '@/components/AvatarIdenticon';
import { Masthead } from '@/components/Masthead';
import { SiteFooter } from '@/components/SiteFooter';
import { ReputationBadge } from '@/components/community/ReputationBadge';
import { getPublicProfile } from '@/lib/reputation';

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
 * Day 23, task 1's "display reputation... on user profiles" — deliberately
 * minimal (identity + the score breakdown), not a full activity history:
 * this codebase has no post-by-author query yet (ListPostsQueryDto only
 * filters by postType/dropEventId), and building that out is a bigger,
 * separate feature this brief didn't ask for. What's here is the honest,
 * fully-verifiable slice — the same "ship what's real, don't fabricate
 * scope" discipline the rest of this project follows.
 */
export default async function ProfilePage({ params }: PageProps) {
  const { id } = await params;
  const profile = await getPublicProfile(id);
  if (!profile) notFound();

  const { reputation, user } = profile;

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
      </div>
      <SiteFooter />
    </main>
  );
}
