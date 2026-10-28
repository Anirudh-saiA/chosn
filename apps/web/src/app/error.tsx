'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { buttonVariantClass } from '@chosn/ui';
import { PageShell } from '@/components/ui/PageShell';

/** Route-level error boundary: keeps the header and footer, so one broken page never blanks the whole site. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageShell width="3xl">
      <div role="alert" className="mx-auto flex max-w-xl flex-col items-center rounded-[28px] border border-text/10 bg-white px-6 py-12 text-center sm:px-10">
        <p className="eyebrow">Error · Unexpected</p>
        <h1 className="mt-4 font-display text-[clamp(1.6rem,6vw,2.5rem)] leading-[1.08] text-text">Something went wrong.</h1>
        <p className="mt-4 text-base text-text-soft">
          That one is on us. The page failed to load. Try again, and if it keeps happening, head back home.
          {error.digest ? <span className="mt-3 block text-sm text-text-faint">Reference: {error.digest}</span> : null}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={() => reset()} className={buttonVariantClass('primary', 'min-h-[48px] px-6')}>
            Try again
          </button>
          <Link href="/" className={buttonVariantClass('secondary', 'min-h-[48px] px-6')}>
            Go home
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
