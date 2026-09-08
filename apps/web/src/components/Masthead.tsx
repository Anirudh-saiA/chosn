import Link from 'next/link';
import { AuthNavStatus } from '@/components/auth/AuthNavStatus';

/**
 * Day 4 kept this wordmark-only deliberately — "no nav links to /compare
 * or /news, since neither page exists yet... a link to a page that
 * 404s isn't a complete version of anything." /sneakers now exists (Day
 * 11) and is a real, complete search/browse page, so this is where the
 * landing page's implicit promise ("compare prices") gets an actual
 * entry point — the condition that kept this link out no longer holds.
 */
export function Masthead() {
  return (
    <header className="border-b border-moss/20 bg-vault px-6 py-5">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/" className="font-display text-xl text-text">
          CH<span className="text-brass">O</span>SN
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            href="/sneakers"
            className="font-mono text-ui-label text-text-soft transition-colors duration-150 ease-chosn hover:text-text"
          >
            Search sneakers
          </Link>
          {/* Day 15 — the magazine, split into two real, complete pages
              rather than one combined link, matching how the two are
              actually separate routes (task 5's nav requirement). */}
          <Link
            href="/drops"
            className="font-mono text-ui-label text-text-soft transition-colors duration-150 ease-chosn hover:text-text"
          >
            Drops
          </Link>
          <Link
            href="/news"
            className="font-mono text-ui-label text-text-soft transition-colors duration-150 ease-chosn hover:text-text"
          >
            News
          </Link>
          {/* Day 14 — real once /notifications has something to manage
              (subscriptions are created from a sneaker page's "Notify me"
              toggle), same "no link to an incomplete page" rule as above. */}
          <Link
            href="/notifications"
            className="font-mono text-ui-label text-text-soft transition-colors duration-150 ease-chosn hover:text-text"
          >
            Notifications
          </Link>
          {/* Day 16 — its own client component, deliberately not read
              here; see AuthNavStatus's own comment on why. */}
          <AuthNavStatus />
        </nav>
      </div>
    </header>
  );
}
