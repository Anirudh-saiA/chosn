import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { auth } from '@/auth';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { ReportsQueue } from '@/components/admin/ReportsQueue';
import { fetchReports } from '@/lib/moderation';

export const metadata: Metadata = { title: 'Moderation' };

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
    <PageShell width="6xl">
      <PageHeader
        eyebrow="Admin · Terminal"
        title="Moderation queue"
        description="Reports filed via the generic reportEntity API — pending first, newest first."
      >
        <Link href="/admin/community-health" className="link-underline inline-flex min-h-[44px] items-center gap-2 font-mono text-meta uppercase tracking-[0.14em] text-brass-bright">
          Community health <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      </PageHeader>
      <ReportsQueue initialReports={reports} apiToken={apiToken} />
    </PageShell>
  );
}
