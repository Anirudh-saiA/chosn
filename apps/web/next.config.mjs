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
const withSentry = (config) =>
  withSentryConfig(config, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    silent: true,
    widenClientFileUpload: true,
    disableLogger: true,
    disableServerWebpackPlugin: true,
    disableClientWebpackPlugin: true,
  });

// Only wrap when Sentry is actually configured. withSentryConfig injects
// sentry.client.config.ts into every page, which bundles and parses the
// full SDK on load — ~90KB doing nothing at all while the DSN is unset
// (Lighthouse measured it as the bulk of a 490ms blocking time). Setting
// NEXT_PUBLIC_SENTRY_DSN restores the previous behaviour automatically;
// nothing else needs changing when Sentry gets set up for real.
export default process.env.NEXT_PUBLIC_SENTRY_DSN ? withSentry(nextConfig) : nextConfig;
