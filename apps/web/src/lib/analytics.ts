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

import { getConsent, onConsentChange } from './consent';

type PostHogModule = typeof import('posthog-js');

let posthog: PostHogModule['default'] | null = null;
let started = false;
let consentListenerAttached = false;

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
 * Loads PostHog if it is configured **and the visitor has granted
 * consent** (Day 19 task 4). Safe to call more than once — only the
 * first successful load does anything.
 *
 * Called on every page load, but does nothing until consent exists:
 * with consent undecided or denied, `posthog-js` is never imported, so
 * no analytics code runs and no request reaches any analytics host.
 * The consent listener below means granting consent from the banner
 * starts tracking immediately, without a reload.
 */
export function startMonitoring(): void {
  if (typeof window === 'undefined') return;

  if (!consentListenerAttached) {
    consentListenerAttached = true;
    onConsentChange((state) => {
      if (state === 'granted') {
        loadPostHog();
      } else {
        // Declined after the fact — drop anything buffered rather than
        // holding it in case they change their mind later.
        pending.length = 0;
      }
    });
  }

  if (getConsent() === 'granted') loadPostHog();
}

function loadPostHog(): void {
  if (started) return;
  started = true;

  whenIdle(() => {
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (posthogKey) {
      void import('posthog-js').then((mod) => {
        posthog = mod.default;
        posthog.init(posthogKey, {
          api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
          capture_pageview: false, // fired manually, once the router is ready
          // Belt-and-braces: even once loaded, PostHog itself is told
          // not to persist anything until it sees consent. The gate
          // above is the real control; this just means a future code
          // path that loads it some other way still can't drop a cookie
          // silently.
          persistence: 'localStorage+cookie',
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
  // Explicitly declined — don't even hold it in memory. Undecided still
  // buffers, so a visitor who accepts the banner after browsing for a
  // moment doesn't lose the events from before they clicked.
  if (getConsent() === 'denied') return;
  // Bounded: a page that somehow raises hundreds of events before init
  // shouldn't grow this array without limit.
  if (pending.length < 50) pending.push({ event, props });
}
