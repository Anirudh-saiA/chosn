import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { Masthead } from '@/components/Masthead';
import { SiteFooter } from '@/components/SiteFooter';
import { fetchCommunityHealth } from '@/lib/moderation';

export const metadata: Metadata = { title: 'Community health | CHOSN' };

const POST_TYPE_LABEL: Record<string, string> = {
  price_check: 'Price Check',
  cop_or_drop: 'Cop or Drop',
  legit_check: 'Legit Check',
  drop_talk: 'Drop Talk',
};

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border border-moss/20 bg-vault-raised p-5">
      <p className="font-mono text-meta uppercase tracking-[0.06em] text-text-faint">{label}</p>
      <p className="mt-2 font-display text-display-section font-semibold text-text">{value}</p>
      {hint && <p className="mt-1 text-meta text-text-faint">{hint}</p>}
    </div>
  );
}

/**
 * Day 24 task 5 — admin-only, extends the Day 17 /admin area the same
 * way /admin/moderation does: `notFound()` for a non-admin (see that
 * page's own comment on why a 404, not a redirect), the real security
 * boundary is apps/api's AdminGuard on every request this page makes.
 * Deliberately not sophisticated per the brief's own framing — a
 * handful of numbers and one early-warning list, not a metrics
 * platform.
 */
export default async function CommunityHealthPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const apiToken = (session as unknown as { apiToken?: string } | null)?.apiToken;
  if (!session?.user || role !== 'admin' || !apiToken) notFound();

  const health = await fetchCommunityHealth(apiToken);
  if (!health) notFound();

  // Group postsPerDay (day, postType, count) into day -> total, for a compact daily total plus a per-type breakdown underneath.
  const dayTotals = new Map<string, number>();
  for (const row of health.postsPerDay) {
    dayTotals.set(row.day, (dayTotals.get(row.day) ?? 0) + row.count);
  }
  const days = [...dayTotals.keys()].sort((a, b) => b.localeCompare(a));

  return (
    <main>
      <Masthead />
      <div className="mx-auto max-w-5xl px-6 py-10 lg:py-14">
        <h1 className="font-display text-display-section font-semibold text-text">Community health</h1>
        <p className="mt-2 max-w-[60ch] text-body text-text-soft">
          Basic signals so community activity isn't a blind spot — not a metrics platform, just enough to notice
          something before it becomes a problem.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile label="Active users (7d)" value={String(health.activeUsers7d)} hint="Posted, commented, or voted" />
          <StatTile
            label="Reports (7d / 30d)"
            value={`${health.reports.last7d} / ${health.reports.last30d}`}
          />
          <StatTile
            label="Resolution rate (30d)"
            value={`${health.reports.resolutionRatePct}%`}
            hint={Object.entries(health.reports.byStatus)
              .map(([status, count]) => `${count} ${status}`)
              .join(' · ')}
          />
        </div>

        <section className="mt-10">
          <h2 className="font-mono text-ui-label font-semibold uppercase tracking-[0.06em] text-text-faint">
            Posts per day, by type (last 14 days)
          </h2>
          {days.length === 0 ? (
            <p className="mt-3 text-meta text-text-faint">No posts yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto border border-moss/20">
              <table className="w-full min-w-[480px] border-collapse text-body">
                <thead>
                  <tr className="border-b border-moss/20 bg-vault-raised">
                    <th className="px-4 py-2.5 text-left font-mono text-meta uppercase tracking-[0.06em] text-text-faint">Day</th>
                    <th className="px-4 py-2.5 text-left font-mono text-meta uppercase tracking-[0.06em] text-text-faint">By type</th>
                    <th className="px-4 py-2.5 text-right font-mono text-meta uppercase tracking-[0.06em] text-text-faint">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((day) => {
                    const rows = health.postsPerDay.filter((r) => r.day === day);
                    return (
                      <tr key={day} className="border-b border-moss/10 last:border-0">
                        <td className="px-4 py-2.5 font-mono text-data-inline text-text">{day}</td>
                        <td className="px-4 py-2.5 text-meta text-text-soft">
                          {rows.map((r) => `${POST_TYPE_LABEL[r.postType] ?? r.postType} (${r.count})`).join(', ')}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-data-inline text-text">{dayTotals.get(day)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-10">
          <h2 className="font-mono text-ui-label font-semibold uppercase tracking-[0.06em] text-text-faint">
            Chat rooms with unusually high report volume (7d)
          </h2>
          <p className="mt-1 text-meta text-text-faint">
            Early-warning signal — a room accumulating message reports fast, most likely during a hyped drop.
          </p>
          {health.highReportRooms.length === 0 ? (
            <p className="mt-3 text-meta text-text-faint">None — nothing above the threshold right now.</p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-moss/15 border-y border-moss/15">
              {health.highReportRooms.map((room) => (
                <li key={room.roomId} className="flex items-center justify-between gap-3 py-3">
                  <Link href={`/drops/${room.dropEventId}`} className="text-body text-text hover:text-brass">
                    {room.sneakerLabel ?? room.roomId}
                  </Link>
                  <span className="font-mono text-meta text-rust">{room.reportCount} reports</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="mt-10 border-t border-moss/15 pt-6 text-meta text-text-faint">
          <Link href="/admin/moderation" className="underline hover:text-text">
            Moderation queue →
          </Link>
        </p>
      </div>
      <SiteFooter />
    </main>
  );
}
