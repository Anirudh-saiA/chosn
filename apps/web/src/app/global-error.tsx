'use client';

import { useEffect } from 'react';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    // Imported dynamically, and only when a DSN exists, so the Sentry
    // SDK stays out of the client bundle entirely while Sentry is
    // unconfigured — it was ~90KB of parse-and-do-nothing on every page
    // load. Set NEXT_PUBLIC_SENTRY_DSN and this wires itself back up.
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
    void import('@sentry/nextjs').then((Sentry) => Sentry.captureException(error));
  }, [error]);

  return (
    <html>
      <body className="flex min-h-screen items-center justify-center bg-vault font-sans text-text">
        <p>Something went wrong. We&apos;ve been notified.</p>
      </body>
    </html>
  );
}
