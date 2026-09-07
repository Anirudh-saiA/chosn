/**
 * Lazily-loaded analytics and error monitoring.
 *
 * Both PostHog and Sentry used to sit in the initial page chunk — Sentry
 * via withSentryConfig injecting sentry.client.config.ts into every page,
 * PostHog via a direct top-level import. Together they accounted for most
 * of a 510ms total blocking time on the deployed landing page: ~117KB of
 * JavaScript parsed and executed before the page could respond to input,
 * on a page whose own code is about 2KB.
 *
 * Neither needs to run before hydration. Analytics only has to be ready
 * before the first event is *sent*, and events raised in the meantime are
 * buffered here and flushed on init, so nothing is lost. The tradeoff is
 * that Sentry cannot catch an exception thrown in the first moment or so
 * after load — acceptable on a landing page, and worth revisiting if this
 * pattern is ever reused on something more stateful.
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
 * Loads whichever of PostHog and Sentry are configured. Safe to call more
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

    const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (sentryDsn) {
      void import('@sentry/nextjs').then((Sentry) => {
        Sentry.init({ dsn: sentryDsn, enabled: true, tracesSampleRate: 0.1 });
      });
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
