import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { DropsAdmin } from '@/components/admin/DropsAdmin';
import { PageShell } from '@/components/ui/PageShell';

export const metadata: Metadata = { title: 'Manage drops', robots: { index: false, follow: false } };

/** Admin only: a plain 404 for anyone else. The real boundary is the API's AdminGuard on every request this page makes. */
export default async function AdminDropsPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const apiToken = (session as unknown as { apiToken?: string } | null)?.apiToken;
  if (!session?.user || role !== 'admin' || !apiToken) notFound();

  return (
    <PageShell width="6xl" plain>
      <header className="mb-8 border-b-2 border-[#0A0A0A] pb-6">
        <p className="font-mono text-[0.72rem] font-bold uppercase tracking-[0.3em] text-[#0A0A0A]/60">Admin</p>
        <h1 className="mt-3 font-display text-[clamp(2.25rem,8vw,5rem)] leading-[0.95] text-[#0A0A0A]">Manage drops.</h1>
        <p className="mt-4 max-w-2xl text-[1.05rem] font-bold leading-relaxed text-[#0A0A0A]/65">
          Add a drop, fix a date, attach the official link, or hide one that should not be public. Every drop needs the source that confirmed it.
          Times are entered in the drop&apos;s own time zone (Indian time by default).
        </p>
      </header>
      <DropsAdmin apiToken={apiToken} />
    </PageShell>
  );
}
