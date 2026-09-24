import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/AuthShell';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata: Metadata = { title: 'Sign in' };

/**
 * Found live: this page had no `dynamic` export, so Next.js prerenders
 * it statically — `googleEnabled` below was evaluated once at *build*
 * time, not per request. `/api/auth/providers` (NextAuth's own dynamic
 * route) correctly showed Google configured, proving AUTH_GOOGLE_ID/
 * SECRET *are* reachable at runtime on Vercel — they just weren't
 * necessarily visible during the build step that produced whichever
 * static HTML was actually being served (a known Vercel distinction:
 * some env vars, e.g. ones marked "Sensitive," are runtime-only and
 * excluded from the build). Forcing this dynamic makes the check happen
 * fresh on every request instead of trusting a build-time snapshot —
 * fixes this regardless of which exact Vercel setting caused the
 * mismatch, and a login page needing a fresh per-request render is a
 * completely ordinary tradeoff, not a real performance cost.
 */
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in"
      description="Pick up your alerts, watchlist and community identity."
      footer={
        <>
          New here?{' '}
          <Link href="/sign-up" className="link-underline font-semibold text-brass-bright">
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm googleEnabled={Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET)} />
    </AuthShell>
  );
}
