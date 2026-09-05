import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // @chosn/ui ships TS source, not a prebuilt package — Next transpiles
  // it directly. No separate build/watch step for the UI package.
  transpilePackages: ['@chosn/ui'],
  reactStrictMode: true,
};

// Sentry's build plugin needs a real auth token to create a release and
// upload source maps — unlike the runtime SDK (sentry.*.config.ts),
// it fails the build outright without one rather than no-op'ing
// quietly. Only wrap the config once a token actually exists.
export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: true,
      widenClientFileUpload: true,
      disableLogger: true,
    })
  : nextConfig;
