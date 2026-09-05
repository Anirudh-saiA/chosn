import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // @chosn/ui ships TS source, not a prebuilt package — Next transpiles
  // it directly. No separate build/watch step for the UI package.
  transpilePackages: ['@chosn/ui'],
  reactStrictMode: true,
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  widenClientFileUpload: true,
  disableLogger: true,
});
