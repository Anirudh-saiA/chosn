import Link from 'next/link';

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
        <nav>
          <Link
            href="/sneakers"
            className="font-mono text-ui-label text-text-soft transition-colors duration-150 ease-chosn hover:text-text"
          >
            Search sneakers
          </Link>
        </nav>
      </div>
    </header>
  );
}
