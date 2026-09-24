import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BadgeCheck, CalendarDays, Lock, MessageSquare, PenLine, ThumbsUp, Trophy } from 'lucide-react';
import { auth } from '@/auth';
import { AvatarIdenticon } from '@/components/AvatarIdenticon';
import { CountUp } from '@/components/fx/CountUp';
import { Reveal } from '@/components/fx/Reveal';
import { PageShell } from '@/components/ui/PageShell';
import { NotificationSettings } from '@/components/community/NotificationSettings';
import { ProfileActivity } from '@/components/community/ProfileActivity';
import { ReportButton } from '@/components/community/ReportButton';
import { reputationTier } from '@/components/community/meta';
import { getUserActivity } from '@/lib/community';
import { getPublicProfile } from '@/lib/reputation';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const profile = await getPublicProfile(id);
  if (!profile) return { title: 'Not found' };
  return { title: `${profile.user.displayName ?? 'Collector'}` };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Day 23 shipped identity + the reputation breakdown. Day 24 (task 3)
 * adds a real activity feed (their own posts/comments — see
 * lib/community.ts's `getUserActivity`) and, only when this is the
 * signed-in viewer's own profile, their notification settings. The
 * own-profile check is a plain id comparison against `auth()`'s
 * session — the actual security boundary for anything that check gates
 * is still `ApiAuthGuard` server-side on every one of those calls.
 */
export default async function ProfilePage({ params }: PageProps) {
  const { id } = await params;
  const [profile, activity, session] = await Promise.all([getPublicProfile(id), getUserActivity(id), auth()]);
  if (!profile) notFound();

  const { reputation, user } = profile;
  const viewerId = (session?.user as unknown as { id?: string } | undefined)?.id;
  const apiToken = (session as unknown as { apiToken?: string } | null)?.apiToken;
  const isOwnProfile = viewerId === id;
  const name = user.displayName ?? `Collector ${id.slice(0, 4)}`;
  const tier = reputationTier(reputation.score);

  const stats = [
    { label: 'Reputation', value: reputation.score, icon: Trophy, accent: true },
    { label: 'Posts', value: activity.posts.length, icon: PenLine },
    { label: 'Comments', value: activity.comments.length, icon: MessageSquare },
    { label: 'Helpful votes', value: reputation.helpfulVotesReceived, icon: ThumbsUp },
  ];

  const badges = [
    { label: tier.label, note: `${reputation.score} reputation`, earned: true },
    { label: 'First post', note: 'Publish a post', earned: activity.posts.length > 0 },
    { label: 'In the conversation', note: '5 comments', earned: activity.comments.length >= 5 },
    { label: 'Trusted voice', note: '50+ reputation', earned: reputation.score >= 50 },
    { label: 'Verified buyer', note: 'Verified purchase', earned: reputation.verifiedPurchaseCount > 0 },
  ];

  const breakdown = [
    { label: 'Account age', detail: null, pts: reputation.accountAgePoints },
    { label: 'Helpful votes received', detail: reputation.helpfulVotesReceived, pts: reputation.helpfulVotePoints },
    { label: 'Verified purchases', detail: reputation.verifiedPurchaseCount, pts: reputation.verifiedPurchasePoints },
  ];
  const maxPts = Math.max(1, ...breakdown.map((b) => b.pts));

  return (
    <PageShell width="5xl">
      {/* hero */}
      <Reveal>
        <section className="panel ticks relative overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: 'radial-gradient(60% 90% at 12% 0%, rgba(255,168,0,.22), transparent 70%), radial-gradient(50% 80% at 100% 100%, rgba(46,242,166,.10), transparent 70%)' }}
          />
          <div className="relative flex flex-col items-start gap-6 p-6 sm:flex-row sm:items-center sm:p-10">
            <AvatarIdenticon seed={user.avatarSeed} size={120} ring />
            <div className="min-w-0 flex-1">
              <p className="eyebrow">Collector profile</p>
              <h1 className="mt-2 break-words font-display text-[clamp(2.25rem,6vw,4rem)] font-bold leading-none tracking-tight text-text">
                {name}
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                <span
                  className={`inline-flex items-center gap-2 border px-3 py-1 font-mono text-ui-label font-semibold ${
                    tier.key === 'veteran'
                      ? 'border-brass/50 bg-brass/10 text-brass-bright'
                      : tier.key === 'established'
                        ? 'border-signal/40 bg-signal/[0.07] text-signal'
                        : 'border-text/20 text-text-soft'
                  }`}
                >
                  <BadgeCheck className="h-4 w-4" aria-hidden /> {tier.label}
                </span>
                <span className="inline-flex items-center gap-2 font-mono text-meta text-text-soft">
                  <CalendarDays className="h-4 w-4" aria-hidden /> Member since {formatDate(reputation.accountCreatedAt)}
                </span>
              </div>
            </div>
            {!isOwnProfile && apiToken && (
              <div className="self-start">
                <ReportButton entityType="user" entityId={id} variant="button" />
              </div>
            )}
          </div>

          <dl className="relative grid grid-cols-2 border-t border-text/[0.08] lg:grid-cols-4">
            {stats.map((s, i) => (
              <div
                key={s.label}
                className={`px-6 py-5 ${i % 2 === 1 ? 'border-l border-text/[0.08]' : ''} ${i > 1 ? 'border-t border-text/[0.08] lg:border-t-0' : ''} ${i > 0 ? 'lg:border-l lg:border-text/[0.08]' : ''}`}
              >
                <dt className="flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-text-soft">
                  <s.icon className="h-3.5 w-3.5" aria-hidden /> {s.label}
                </dt>
                <dd
                  className={`mt-2 font-mono text-[2.25rem] font-bold leading-none ${s.accent ? 'text-brass-gradient' : 'text-text'}`}
                >
                  <CountUp to={s.value} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </Reveal>

      <div className="mt-10 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0">
          <h2 className="sr-only">Activity</h2>
          <ProfileActivity posts={activity.posts} comments={activity.comments} name={name} />
        </div>

        <aside className="flex flex-col gap-6">
          <section className="panel p-5" aria-labelledby="rep-h">
            <h2 id="rep-h" className="eyebrow">
              Reputation breakdown
            </h2>
            <p className="mt-2 text-meta text-text-soft">
              Transparent by design — a sum of named points, not a black box. See{' '}
              <Link href="/community-guidelines" className="text-brass-bright underline underline-offset-4">
                Community Guidelines
              </Link>
              .
            </p>
            <ul className="mt-5 flex flex-col gap-4">
              {breakdown.map((b) => (
                <li key={b.label}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-ui-label text-text">
                      {b.label}
                      {b.detail != null && <span className="ml-1.5 font-mono text-meta text-text-soft">({b.detail})</span>}
                    </span>
                    <span className="font-mono text-ui-label font-semibold text-text">{b.pts} pts</span>
                  </div>
                  <div className="mt-1.5 h-1 bg-text/10" aria-hidden>
                    <div className="h-full bg-brass-gradient" style={{ width: `${(b.pts / maxPts) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex items-baseline justify-between border-t border-text/[0.08] pt-4">
              <span className="text-ui-label font-semibold text-text">Total</span>
              <span className="font-mono text-xl font-bold text-brass-bright">{reputation.score} pts</span>
            </div>
            {reputation.verifiedPurchaseCount === 0 && (
              <p className="mt-4 border-t border-text/[0.08] pt-4 text-meta text-text-soft">
                Verified purchases aren&apos;t tracked yet — CHOSN doesn&apos;t process purchases (it&apos;s price
                intelligence, not a marketplace), so this stays a placeholder until a real verification signal exists.
              </p>
            )}
          </section>

          <section className="panel p-5" aria-labelledby="badge-h">
            <h2 id="badge-h" className="eyebrow">
              Badges
            </h2>
            <ul className="mt-4 grid grid-cols-2 gap-2.5">
              {badges.map((b) => (
                <li
                  key={b.label}
                  className={`border p-3 ${b.earned ? 'border-brass/40 bg-brass/[0.07]' : 'border-text/10 bg-vault-deep/40'}`}
                >
                  <p className="flex items-center gap-1.5 text-ui-label font-semibold text-text">
                    {b.earned ? (
                      <BadgeCheck className="h-4 w-4 shrink-0 text-brass-bright" aria-hidden />
                    ) : (
                      <Lock className="h-3.5 w-3.5 shrink-0 text-text-soft" aria-hidden />
                    )}
                    {b.label}
                  </p>
                  <p className="mt-1 font-mono text-[0.65rem] text-text-soft">
                    {b.earned ? 'Earned' : 'Locked'} · {b.note}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      {isOwnProfile && apiToken && <NotificationSettings apiToken={apiToken} />}
    </PageShell>
  );
}
