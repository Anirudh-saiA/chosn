/**
 * Sentry, reinstalled (Day 33). Previously removed entirely (see
 * next.config.mjs's own history/comment) because NEXT_PUBLIC_SENTRY_DSN
 * was never actually set, so the SDK reported nowhere while still
 * costing ~111KB per page load. A real DSN now exists (chosn-web, a
 * separate Sentry project from the API's chosn-api), so this is worth
 * paying for again — but kept as lean as the original removal reasoning
 * demands: no session replay, no performance tracing (tracesSampleRate:
 * 0), error capture only. And still fully no-op with zero DSN set, same
 * convention as every other optional integration in this codebase
 * (RESEND_API_KEY, PERSPECTIVE_API_KEY, retailer credentials) — Sentry's
 * own SDK already treats an empty `dsn` as "disabled," so no extra
 * guard is needed here beyond just always calling init().
 *
 * Next.js's own instrumentation hook — this file's register() runs once
 * per server/edge runtime instance, separate from instrumentation-client.ts
 * (the browser side, Next 15.3+'s replacement for sentry.client.config.ts).
 */
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NEXT_PUBLIC_VERCEL_ENV === 'production' ? 'production' : 'staging',
      tracesSampleRate: 0,
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NEXT_PUBLIC_VERCEL_ENV === 'production' ? 'production' : 'staging',
      tracesSampleRate: 0,
    });
  }
}

// Required by @sentry/nextjs when App Router route handlers can throw —
// forwards a request-scoped error to Sentry with the request context
// attached, distinct from register()'s one-time SDK init above.
export const onRequestError = Sentry.captureRequestError;
