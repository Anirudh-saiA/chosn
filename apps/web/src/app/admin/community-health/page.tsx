import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { Activity, ArrowRight, Flag, Gauge, Siren } from 'lucide-react';
import { auth } from '@/auth';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { CountUp } from '@/components/fx/CountUp';
import { fetchCommunityHealth } from '@/lib/moderation';

export const metadata: Metadata = { title: 'Community health' };

const POST_TYPE_LABEL: Record<string, string> = {
  price_check: 'Price Check',
  cop_or_drop: 'Cop or Drop',
  legit_check: 'Legit Check',
  drop_talk: 'Drop Talk',
};

function StatTile({ icon, label, children, hint }: { icon: ReactNode; label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="panel ticks p-5">
      <p className="flex items-center gap-2 font-mono text-meta uppercase tracking-[0.16em] text-text-soft">
        <span className="text-brass">{icon}</span>
        {label}
      </p>
      <p className="mt-4 font-mono text-4xl font-medium leading-none text-text sm:text-[2.75rem]">{children}</p>
      {hint && <p className="mt-3 font-mono text-meta text-text-faint">{hint}</p>}
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
  const maxTotal = Math.max(1, ...dayTotals.values());

  return (
    <PageShell width="6xl">
      <PageHeader
        eyebrow="Admin · Terminal"
        title="Community health"
        description="Basic signals so community activity isn't a blind spot — not a metrics platform, just enough to notice something before it becomes a problem."
      >
        <Link href="/admin/moderation" className="link-underline inline-flex min-h-[44px] items-center gap-2 font-mono text-meta uppercase tracking-[0.14em] text-brass-bright">
          Moderation queue <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile icon={<Activity aria-hidden className="h-4 w-4" />} label="Active users (7d)" hint="Posted, commented, or voted">
          <CountUp to={health.activeUsers7d} />
        </StatTile>
        <StatTile icon={<Flag aria-hidden className="h-4 w-4" />} label="Reports (7d / 30d)">
          <CountUp to={health.reports.last7d} />
          <span className="mx-1.5 text-text-faint">/</span>
          <CountUp to={health.reports.last30d} />
        </StatTile>
        <StatTile
          icon={<Gauge aria-hidden className="h-4 w-4" />}
          label="Resolution rate (30d)"
          hint={Object.entries(health.reports.byStatus)
            .map(([status, count]) => `${count} ${status}`)
            .join(' · ')}
        >
          <CountUp to={health.reports.resolutionRatePct} suffix="%" />
        </StatTile>
      </div>

      <section className="mt-12" aria-labelledby="ppd">
        <h2 id="ppd" className="eyebrow">
          Posts per day, by type (last 14 days)
        </h2>
        {days.length === 0 ? (
          <p className="mt-4 border border-dashed border-text/15 px-4 py-8 text-center text-meta text-text-faint">No posts yet.</p>
        ) : (
          <div className="panel mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr className="border-b border-text/10 bg-vault-recessed/60">
                  <th scope="col" className="px-4 py-3 text-left font-mono text-meta font-medium uppercase tracking-[0.14em] text-text-soft">Day</th>
                  <th scope="col" className="px-4 py-3 text-left font-mono text-meta font-medium uppercase tracking-[0.14em] text-text-soft">By type</th>
                  <th scope="col" className="px-4 py-3 text-right font-mono text-meta font-medium uppercase tracking-[0.14em] text-text-soft">Total</th>
                </tr>
              </thead>
              <tbody>
                {days.map((day) => {
                  const rows = health.postsPerDay.filter((r) => r.day === day);
                  const total = dayTotals.get(day) ?? 0;
                  return (
                    <tr key={day} className="border-b border-text/[0.06] transition-colors last:border-0 hover:bg-text/[0.03]">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-data-inline text-text">{day}</td>
                      <td className="px-4 py-3 text-meta text-text-soft">
                        {rows.map((r) => `${POST_TYPE_LABEL[r.postType] ?? r.postType} (${r.count})`).join(', ')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-3">
                          <span aria-hidden className="hidden h-1.5 w-24 bg-text/[0.06] sm:block">
                            <span className="block h-full bg-brass-gradient" style={{ width: `${Math.round((total / maxTotal) * 100)}%` }} />
                          </span>
                          <span className="w-8 text-right font-mono text-data-inline text-text">{total}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-12" aria-labelledby="hrr">
        <h2 id="hrr" className="eyebrow flex items-center gap-2">
          <Siren aria-hidden className="h-3.5 w-3.5" />
          Chat rooms with unusually high report volume (7d)
        </h2>
        <p className="mt-2 text-meta text-text-faint">
          Early-warning signal — a room accumulating message reports fast, most likely during a hyped drop.
        </p>
        {health.highReportRooms.length === 0 ? (
          <p className="mt-4 border border-dashed border-signal/25 px-4 py-8 text-center text-meta text-text-soft">
            None — nothing above the threshold right now.
          </p>
        ) : (
          <ul className="panel mt-4 flex flex-col divide-y divide-text/[0.06]">
            {health.highReportRooms.map((room) => (
              <li key={room.roomId} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-text/[0.03]">
                <Link href={`/drops/${room.dropEventId}`} className="text-body text-text hover:text-brass-bright">
                  {room.sneakerLabel ?? room.roomId}
                </Link>
                <span className="border border-rust/40 bg-rust/10 px-2 py-0.5 font-mono text-meta text-rust">{room.reportCount} reports</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
