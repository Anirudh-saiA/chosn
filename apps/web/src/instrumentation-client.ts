/**
 * Browser-side half of Day 33's Sentry reinstall — see instrumentation.ts
 * for why this exists again and why it's kept deliberately lean. No
 * session replay (real cost, not needed to just catch errors), no
 * performance tracing. This file's name/location is Next.js 15.3+'s own
 * convention (replaces sentry.client.config.ts) — it's loaded
 * automatically, no import needed anywhere else.
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV === 'production' ? 'production' : 'staging',
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});

// Required by @sentry/nextjs for capturing errors during client-side
// navigation (App Router doesn't route these through onRequestError).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
