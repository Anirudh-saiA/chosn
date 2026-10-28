import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CompareView } from '@/components/compare/CompareView';
import { PageShell } from '@/components/ui/PageShell';
import { fetchCompare } from '@/lib/catalog';

export const metadata: Metadata = {
  title: 'Compare sneakers',
  description: 'Put up to four sneakers side by side: best price, every store and the sizes in stock.',
};

// Prices change; this page is cheap to render and driven entirely by the query string.
export const dynamic = 'force-dynamic';

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ styles?: string }> }) {
  const { styles } = await searchParams;
  const codes = (styles ?? '').split(',').map((c) => c.trim()).filter(Boolean).slice(0, 4);
  const items = await fetchCompare(codes, { cache: 'no-store' }).catch(() => []);

  return (
    <PageShell width="full">
      <nav aria-label="Breadcrumb" className="mb-6 font-mono text-meta text-text-soft">
        <Link href="/sneakers" className="link-underline inline-flex items-center gap-1.5 hover:text-text">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> All sneakers
        </Link>
      </nav>

      <header className="mb-8 max-w-2xl">
        <p className="eyebrow">Side by side</p>
        <h1 className="mt-2 font-display text-[clamp(2.25rem,5vw,3.75rem)] font-bold leading-[0.98] tracking-tight text-text">
          Compare sneakers
        </h1>
        <p className="mt-3 text-[1.02rem] leading-relaxed text-text-soft">
          Best price, every store that has the pair in stock, and the sizes available — for up to four sneakers at once.
          The cheapest price in each row is ticked.
        </p>
      </header>

      {items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-text/20 bg-white p-10 text-center">
          <h2 className="font-display text-2xl font-bold uppercase text-text">Nothing to compare yet</h2>
          <p className="mx-auto mt-2 max-w-md text-text-soft">
            Open any sneaker and press <strong>Compare</strong>, or use the <strong>+</strong> on a card. Pick two to four, then come back here.
          </p>
          <Link href="/sneakers" className="mt-6 inline-flex min-h-[44px] items-center rounded-full bg-[#0A0A0A] px-6 font-mono text-[0.74rem] font-bold uppercase tracking-[0.14em] text-white">
            Browse sneakers
          </Link>
        </div>
      ) : (
        <>
          <CompareView items={items} />
          {items.length < 4 && (
            <p className="mt-5 text-[0.9rem] text-text-soft">
              Want another?{' '}
              <Link href="/sneakers" className="link-underline font-semibold text-text">
                Browse sneakers
              </Link>{' '}
              and add up to {4 - items.length} more — your picks stay in the tray.
            </p>
          )}
        </>
      )}
    </PageShell>
  );
}
