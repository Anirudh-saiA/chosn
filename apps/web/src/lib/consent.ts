/**
 * Consent state for non-essential tracking (Day 19 task 4).
 *
 * The important property, and the reason this is a real module rather
 * than a banner component's local state: **nothing non-essential loads
 * until consent is explicitly granted.** `startMonitoring()` in
 * analytics.ts now checks this first, so a visitor who never answers
 * the banner — or declines — never has PostHog initialised at all, and
 * no request is made to any analytics host. A banner that renders while
 * the tracker has already loaded behind it is theatre; this is the
 * difference.
 *
 * Default is `null` (undecided) and undecided is treated exactly like
 * declined for loading purposes — the brief's "default to the most
 * privacy-preserving option, don't pre-check consent" requirement, and
 * the correct default under both the DPDP Act's consent model and
 * GDPR's.
 *
 * Essential functionality deliberately does NOT read this: the
 * NextAuth session cookie, the waitlist POST, and the notification
 * subscriber id are all strictly necessary to deliver what the user
 * asked for, so they are not gated behind a consent choice they might
 * decline. See docs/legal/README.md for the full essential vs.
 * non-essential split.
 */

export type ConsentState = 'granted' | 'denied';

const STORAGE_KEY = 'chosn-analytics-consent';

/** Fires when consent changes so analytics.ts can start (or stay off) without a reload. */
const CONSENT_EVENT = 'chosn:consent-changed';

/** `null` = not yet answered. Treated as "denied" everywhere that matters. */
export function getConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === 'granted' || raw === 'denied' ? raw : null;
  } catch {
    // Private mode / storage blocked — treat as undecided, which means
    // nothing non-essential loads. Failing closed is the right
    // direction for a consent check.
    return null;
  }
}

export function setConsent(state: ConsentState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, state);
  } catch {
    // Can't persist — the choice still applies for this page's lifetime
    // via the event below; the banner will simply ask again next visit.
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: state }));
}

export function onConsentChange(handler: (state: ConsentState) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const listener = (event: Event) => handler((event as CustomEvent<ConsentState>).detail);
  window.addEventListener(CONSENT_EVENT, listener);
  return () => window.removeEventListener(CONSENT_EVENT, listener);
}
