import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // @chosn/ui ships TS source, not a prebuilt package — Next transpiles
  // it directly. No separate build/watch step for the UI package.
  transpilePackages: ['@chosn/ui'],
  reactStrictMode: true,
};

// Sentry's build plugin tries to create a release and upload source
// maps via sentry-cli, and fails the build outright ('Project not
// found') unless org/project/token resolve to a real Sentry project —
// unlike the runtime SDK, which no-ops quietly without a DSN. We saw
// this fail even with SENTRY_AUTH_TOKEN unset on our end, meaning
// something (likely an auto-suggested Vercel↔Sentry integration) was
// injecting one anyway — so this doesn't trust env vars at all. It's
// hard-disabled until Sentry is actually being set up: flip both to
// `false` at that point, once org/project/token point at a real
// project.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  widenClientFileUpload: true,
  disableLogger: true,
  disableServerWebpackPlugin: true,
  disableClientWebpackPlugin: true,
});
