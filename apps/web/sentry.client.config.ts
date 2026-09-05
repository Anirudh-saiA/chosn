import * as Sentry from '@sentry/nextjs';

// No-ops until NEXT_PUBLIC_SENTRY_DSN is set — lets the skeleton run and
// deploy today without a Sentry project existing yet.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: 0.1,
});
