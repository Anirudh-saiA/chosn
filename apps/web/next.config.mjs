// Day 16 task 9 — real findings from a local OWASP ZAP baseline scan
// (see apps/web/src/lib/auth/README.md's Verification section for the
// actual before/after alert counts): CSP and X-Frame-Options were
// Medium risk; the rest (X-Content-Type-Options, Permissions-Policy,
// X-Powered-By, Cross-Origin-Resource-Policy) were Low, fixed in the
// same pass since they're free once `headers()` exists at all.
function apiOrigin() {
  const url = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  const { protocol, host } = new URL(url);
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
  return { http: `${protocol}//${host}`, ws: `${wsProtocol}//${host}` };
}

function cspHeaderValue() {
  const api = apiOrigin();
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

  const directives = {
    'default-src': ["'self'"],
    // 'unsafe-inline', not a nonce — a real, disclosed tradeoff, not an
    // oversight. Next.js's own documented nonce pattern requires every
    // page that uses it to render dynamically (no static/ISR caching at
    // all), which would undo Day 11's and Day 15's actual, measured
    // performance work (generateStaticParams, ISR revalidate) across
    // most of this app's real traffic. `'unsafe-inline'` still blocks
    // this CSP's main practical value against the common case — a
    // remote/attacker-hosted <script src> or exfiltration via an
    // injected external request — it just doesn't stop inline-script
    // XSS the way a nonce would. Revisit if a real XSS finding ever
    // surfaces that this specific gap would have stopped.
    'script-src': ["'self'", "'unsafe-inline'"],
    'style-src': ["'self'", "'unsafe-inline'"], // Next's App Router injects some CSS as inline <style>; far lower risk than inline script
    'img-src': ["'self'", 'data:'], // data: for the TOTP QR code (lib/auth/totp.ts) and any future data-URI placeholder art
    'font-src': ["'self'"], // next/font self-hosts every face at build time (layout.tsx's own comment) — no fonts.gstatic.com needed at runtime
    'connect-src': ["'self'", api.http, api.ws, posthogHost],
    'frame-ancestors': ["'none'"], // the actual CSP-level anti-clickjacking directive — X-Frame-Options below is the same protection for older browsers that don't read this
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
  };

  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // @chosn/ui ships TS source, not a prebuilt package — Next transpiles
  // it directly. No separate build/watch step for the UI package.
  transpilePackages: ['@chosn/ui'],
  reactStrictMode: true,
  // Stops Next.js announcing itself via X-Powered-By — cheap, real fix
  // for the ZAP-flagged "Server Leaks Information" finding (10037).
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: cspHeaderValue() },
          // X-Frame-Options: the ZAP-flagged Medium "Missing Anti-
          // clickjacking Header" (10020) — belt-and-suspenders with
          // frame-ancestors above for browsers that only honor the
          // older header.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Explicitly denies every powerful browser API this app
          // doesn't use, rather than leaving the default (permissive
          // for same-origin) — ZAP-flagged 10063.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          // 'same-origin', not 'same-site': the login/signup flows
          // navigate through Google's own OAuth domain and back — a
          // stricter cross-origin-resource-policy would block that
          // redirect chain. ZAP-flagged 90004.
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          // Started as 'same-origin-allow-popups' (a defensive guess
          // for a hypothetical popup-based OAuth flow), then corrected
          // to the strict value: re-scanning with ZAP flagged the
          // looser one by name as "considered less secured" — checked
          // against this app's actual sign-in call
          // (`signIn('google', {callbackUrl: '/'})` in LoginForm.tsx),
          // which is a full top-level redirect, not `window.open()`.
          // Revisit only if a real popup-based flow is ever added.
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          // Cross-Origin-Embedder-Policy deliberately NOT set, even
          // though ZAP also flags its absence: COEP's only real value
          // is enabling cross-origin isolation for APIs this app
          // doesn't use (SharedArrayBuffer, precise timers). Turning it
          // on (`require-corp`) would require verifying that every
          // cross-origin resource this app loads — PostHog's script and
          // beacon calls, Google's OAuth redirect chain — sends back a
          // matching CORP/CORS header, which isn't something this
          // service controls on either of those origins. The realistic
          // outcome of guessing wrong here is silently broken
          // analytics or a broken login, for a header whose actual
          // protection this app has no use for. Skipped on purpose.
        ],
      },
    ];
  },
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
