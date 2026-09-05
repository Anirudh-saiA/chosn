'use client';

import { Suspense, useEffect, type ReactNode } from 'react';
import posthog from 'posthog-js';
import { usePathname, useSearchParams } from 'next/navigation';

let initialized = false;

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!initialized) return;
    const query = searchParams.toString();
    posthog.capture('$pageview', { $current_url: query ? `${pathname}?${query}` : pathname });
  }, [pathname, searchParams]);

  return null;
}

/**
 * Wires the pipe now so Phase 1–5 events (waitlist signup, "View Deal"
 * clicks, drop page views) only need a `posthog.capture(...)` call later
 * — no new plumbing. No-ops until NEXT_PUBLIC_POSTHOG_KEY is set.
 */
export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (key && !initialized) {
      posthog.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
        capture_pageview: false, // fired manually below, once the router's ready
      });
      initialized = true;
    }
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
