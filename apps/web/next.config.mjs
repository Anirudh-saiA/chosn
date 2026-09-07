/** @type {import('next').NextConfig} */
const nextConfig = {
  // @chosn/ui ships TS source, not a prebuilt package — Next transpiles
  // it directly. No separate build/watch step for the UI package.
  transpilePackages: ['@chosn/ui'],
  reactStrictMode: true,
};

// Sentry was removed from the browser bundle deliberately. It reported
// nowhere — no NEXT_PUBLIC_SENTRY_DSN was ever set — while still costing
// ~111KB of JavaScript downloaded and executed on every visit, which was
// the single largest remaining item in the Lighthouse performance budget.
//
// Server-side error tracking is unaffected: apps/api still runs
// @sentry/node, which is where the price-pipeline dead-letter alerts go.
// To restore browser tracking at launch, reinstall @sentry/nextjs and
// wrap this config with withSentryConfig again.
export default nextConfig;
