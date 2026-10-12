import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { PriceImport } from '@/components/admin/PriceImport';
import { PageShell } from '@/components/ui/PageShell';

export const metadata: Metadata = { title: 'Import prices', robots: { index: false, follow: false } };

/**
 * Admin only (same gate as the moderation page: a plain 404 for anyone else;
 * the real boundary is the API's AdminGuard on every request this page makes).
 */
export default async function ImportPricesPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const apiToken = (session as unknown as { apiToken?: string } | null)?.apiToken;
  if (!session?.user || role !== 'admin' || !apiToken) notFound();

  return (
    <PageShell width="6xl" plain>
      <header className="mb-8 border-b-2 border-[#0A0A0A] pb-6">
        <p className="font-mono text-[0.72rem] font-bold uppercase tracking-[0.3em] text-[#0A0A0A]/60">Admin</p>
        <h1 className="mt-3 font-display text-[clamp(3rem,9vw,7rem)] uppercase leading-[0.88] text-[#0A0A0A]">Import prices.</h1>
        <p className="mt-4 max-w-2xl text-[1.05rem] font-bold leading-relaxed text-[#0A0A0A]/65">
          Upload a spreadsheet saved as CSV: one row per sneaker, size and store. Check it first, then import. New sneakers, sizes and stores are created for you.
          The Compare page lists everything A to Z by brand, then model.
        </p>
      </header>
      <PriceImport apiToken={apiToken} />
    </PageShell>
  );
}
