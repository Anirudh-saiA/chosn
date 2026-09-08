import Link from 'next/link';

/**
 * Not the site's real Masthead (moss/vault/brass) — that component is
 * locked to the Day 2 system on purpose and would clash sitting on top
 * of this page's black/bone ground. A minimal wordmark + one link is
 * enough here; every other route keeps the full nav.
 */
export function LandingMasthead() {
  return (
    <header className="absolute inset-x-0 top-0 z-20 px-6 py-6 sm:px-10 sm:py-8">
      <div className="mx-auto flex max-w-[90rem] items-center justify-between">
        <Link href="/" className="font-editorial text-lg font-semibold tracking-tight text-bone">
          CH<span className="text-ember">O</span>SN
        </Link>
        <Link
          href="/login"
          className="font-grotesk text-sm text-bone/80 transition-colors duration-200 hover:text-bone"
        >
          Sign in
        </Link>
      </div>
    </header>
  );
}
