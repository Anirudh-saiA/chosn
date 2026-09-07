/**
 * Lazily-loaded analytics.
 *
 * PostHog used to sit in the initial page chunk, imported at the top level
 * by both the provider and WaitlistForm. It doesn't need to run before
 * hydration — analytics only has to be ready before the first event is
 * *sent* — so it now loads once the browser is idle, and events raised in
 * the meantime are buffered here and flushed on init.
 *
 * Sentry used to load here too and was removed entirely: it reported
 * nowhere, since no NEXT_PUBLIC_SENTRY_DSN was ever configured, while
 * still costing ~111KB per visit. Server-side tracking is unaffected —
 * apps/api still runs @sentry/node.
 */

type PostHogModule = typeof import('posthog-js');

let posthog: PostHogModule['default'] | null = null;
let started = false;

/** Events raised before the SDKs finish loading, flushed on init. */
const pending: Array<{ event: string; props?: Record<string, unknown> }> = [];

/** Runs `fn` once the browser is idle, with a timeout so it always runs. */
function whenIdle(fn: () => void): void {
  if (typeof window === 'undefined') return;
  const ric = (window as unknown as { requestIdleCallback?: typeof requestIdleCallback })
    .requestIdleCallback;
  if (typeof ric === 'function') {
    ric(fn, { timeout: 3000 });
  } else {
    // Safari has no requestIdleCallback; a timeout past first paint is close enough.
    window.setTimeout(fn, 1500);
  }
}

/**
 * Loads PostHog if it is configured. Safe to call more
 * than once — only the first call does anything.
 */
export function startMonitoring(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  whenIdle(() => {
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (posthogKey) {
      void import('posthog-js').then((mod) => {
        posthog = mod.default;
        posthog.init(posthogKey, {
          api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
          capture_pageview: false, // fired manually, once the router is ready
        });
        for (const { event, props } of pending.splice(0)) {
          posthog.capture(event, props);
        }
      });
    } else {
      pending.length = 0; // nothing will ever send these
    }
  });
}

/**
 * Records an event. Callers don't need to know whether the SDK has loaded
 * yet, or whether analytics is configured at all — before init the event
 * is buffered, and with no key it's dropped.
 */
export function capture(event: string, props?: Record<string, unknown>): void {
  if (posthog) {
    posthog.capture(event, props);
    return;
  }
  // Bounded: a page that somehow raises hundreds of events before init
  // shouldn't grow this array without limit.
  if (pending.length < 50) pending.push({ event, props });
}
