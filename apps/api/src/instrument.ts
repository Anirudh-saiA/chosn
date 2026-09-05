// Must be the first import in main.ts — Sentry needs to patch Node's
// core modules before anything else touches them. No-ops until
// SENTRY_DSN is set.
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  tracesSampleRate: 0.1,
});
