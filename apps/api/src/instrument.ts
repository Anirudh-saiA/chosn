// Must be the first import in main.ts — Sentry needs to patch Node's
// core modules before anything else touches them. No-ops until
// SENTRY_DSN is set.
import * as Sentry from '@sentry/node';

/**
 * Day 27 — staging and production share one Sentry project (no new
 * external project to provision), distinguished by this tag instead.
 * `RAILWAY_ENVIRONMENT_NAME` is set automatically by Railway on every
 * deploy, equal to whichever environment name you gave it in the
 * dashboard (e.g. "production", "staging") — no new env var to
 * remember to set per environment, unlike most of the vars in
 * .env.example. Falls back to NODE_ENV, then a plain "development" for
 * a local run.
 */
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  environment: process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.NODE_ENV ?? 'development',
  tracesSampleRate: 0.1,
  // SEC-7: watch ids sit in URL paths and e-mail addresses in request bodies; keep both out of error reports.
  sendDefaultPii: false,
  beforeSend(event) {
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
      if (event.request.url) event.request.url = event.request.url.replace(UUID_RE, ':id');
    }
    return event;
  },
});
