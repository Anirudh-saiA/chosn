'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { buttonVariantClass } from '@chosn/ui';

/**
 * Deliberately its own small client component, not read inside
 * `Masthead`'s server ancestors. Several pages that render `Masthead`
 * are ISR'd with `generateStaticParams`; reading the session
 * server-side would force them dynamic. Reading it here via
 * `useSession()` keeps the rest of every page statically generated —
 * only this nav fragment hydrates with per-visitor state.
 */
export function AuthNavStatus() {
  const { data: session, status } = useSession();

  if (status === 'loading') return <span className="inline-block h-9 w-24" aria-hidden />;

  if (!session) {
    return (
      <div className="flex items-center gap-1.5">
        <Link
          href="/login"
          className="px-3 py-2 font-sans text-ui-label font-medium text-text-soft transition-colors hover:text-text"
        >
          Sign in
        </Link>
        <Link href="/sign-up" className={buttonVariantClass('primary', '!py-[7px] !px-4')}>
          Join
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Link
        href="/account/security"
        className="px-3 py-2 font-sans text-ui-label font-medium text-text-soft transition-colors hover:text-text"
      >
        Account
      </Link>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: '/' })}
        className="px-3 py-2 font-sans text-ui-label font-medium text-text-soft transition-colors hover:text-text"
      >
        Sign out
      </button>
    </div>
  );
}
