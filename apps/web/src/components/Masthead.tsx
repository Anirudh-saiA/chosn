/**
 * Deliberately just the wordmark — no nav links to /compare or /news,
 * since neither page exists yet. A link to a page that 404s isn't a
 * complete version of anything; it's a broken one.
 */
export function Masthead() {
  return (
    <header className="border-b border-moss/20 bg-vault px-6 py-5">
      <p className="mx-auto max-w-6xl font-display text-xl text-text">
        CH<span className="text-brass">O</span>SN
      </p>
    </header>
  );
}
