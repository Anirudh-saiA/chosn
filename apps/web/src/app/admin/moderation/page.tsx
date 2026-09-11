import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { Masthead } from '@/components/Masthead';
import { SiteFooter } from '@/components/SiteFooter';
import { ReportsQueue } from '@/components/admin/ReportsQueue';
import { fetchReports } from '@/lib/moderation';

export const metadata: Metadata = { title: 'Moderation | CHOSN' };

/**
 * Task 5 — deliberately minimal: a queue, the reported content's raw
 * ids, and two actions. This exists so the mechanism works today, not
 * to be the moderation tooling CHOSN ships once real community content
 * exists to review.
 *
 * `notFound()`, not `redirect('/login')`, for a non-admin — this route
 * shouldn't announce its own existence to someone it's rejecting
 * (see docs/trust-and-safety/README.md's anonymity-audit section for
 * the same reasoning applied here: what a 404 vs. a 403 or a redirect
 * leaks). `role` here is the JWT-cached copy (see auth.ts's own
 * comment) — fine for this page-level gate; the actual security
 * boundary is apps/api's AdminGuard, re-checked live on every request
 * this page or its action buttons make.
 */
export default async function ModerationPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const apiToken = (session as unknown as { apiToken?: string } | null)?.apiToken;
  if (!session?.user || role !== 'admin' || !apiToken) notFound();

  const { reports } = await fetchReports(apiToken);

  return (
    <main>
      <Masthead />
      <div className="mx-auto max-w-5xl px-6 py-10 lg:py-14">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="font-display text-display-section font-semibold text-text">Moderation queue</h1>
          <Link href="/admin/community-health" className="font-mono text-meta text-brass hover:underline">
            Community health →
          </Link>
        </div>
        <p className="mt-2 max-w-[60ch] text-body text-text-soft">
          Reports filed via the generic reportEntity API — pending first, newest first.
        </p>
        <div className="mt-8">
          <ReportsQueue initialReports={reports} apiToken={apiToken} />
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
