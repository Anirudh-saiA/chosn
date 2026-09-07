'use client';

import { Suspense, useEffect, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { capture, startMonitoring } from './analytics';

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.toString();
    capture('$pageview', { $current_url: query ? `${pathname}?${query}` : pathname });
  }, [pathname, searchParams]);

  return null;
}

/**
 * Kicks off analytics and error monitoring once the browser is idle, and
 * tracks pageviews. Replaces the previous PostHogProvider, which imported
 * posthog-js at the top level and so pulled it into the initial bundle.
 *
 * Renders nothing itself — the SDKs are loaded imperatively rather than
 * as components, so there's no wrapper element in the tree.
 */
export function MonitoringProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    startMonitoring();
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
    </>
  );
}
