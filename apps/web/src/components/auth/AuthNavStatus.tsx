'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';

/**
 * Deliberately its own small client component, not read inside
 * `Masthead` itself (which stays a plain Server Component). Several
 * pages that render `Masthead` are ISR'd with `generateStaticParams`
 * (the drop calendar, news feed, sneaker price pages, Day 11/15's own
 * performance work) — `auth()`'s session read touches request cookies,
 * and doing that inside a Server Component forces Next.js to bail out
 * of static generation for the whole page. Reading the session
 * client-side via `useSession()` instead means the rest of the page
 * stays statically generated; only this one nav fragment hydrates with
 * per-visitor state.
 */
export function AuthNavStatus() {
  const { data: session, status } = useSession();

  if (status === 'loading') return null; // resolves in one client render pass, not worth a skeleton

  if (!session) {
    return (
      <Link
        href="/login"
        className="font-mono text-ui-label text-text-soft transition-colors duration-150 ease-chosn hover:text-text"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <Link
        href="/account/security"
        className="font-mono text-ui-label text-text-soft transition-colors duration-150 ease-chosn hover:text-text"
      >
        Account
      </Link>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: '/' })}
        className="font-mono text-ui-label text-text-soft transition-colors duration-150 ease-chosn hover:text-text"
      >
        Sign out
      </button>
    </div>
  );
}
