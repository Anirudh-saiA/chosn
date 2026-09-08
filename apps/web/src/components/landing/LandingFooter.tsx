import Link from 'next/link';

/**
 * "Hairline divider, small text links only" — the affiliate line here
 * is a shorter, footer-appropriate restatement of
 * pricing/AffiliateDisclosure.tsx's real language (that component's
 * own convention is to sit next to an actual offer table, which this
 * page doesn't have — it's a preview, not a live comparison).
 */
export function LandingFooter() {
  return (
    <footer className="bg-bone px-6 py-10 sm:px-10">
      <div className="mx-auto max-w-[90rem] border-t border-ink/10 pt-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <nav className="flex flex-wrap gap-x-6 gap-y-2 font-grotesk text-sm text-ink/60">
            <Link href="/sneakers" className="transition-colors hover:text-ink">
              Search
            </Link>
            <Link href="/drops" className="transition-colors hover:text-ink">
              Drops
            </Link>
            <Link href="/community-guidelines" className="transition-colors hover:text-ink">
              Community Guidelines
            </Link>
            <Link href="/transparency" className="transition-colors hover:text-ink">
              Transparency
            </Link>
          </nav>
          <p className="font-grotesk text-xs text-ink/40">© {new Date().getFullYear()} CHOSN</p>
        </div>
        <p className="mt-6 font-grotesk text-xs text-ink/40">
          CHOSN compares prices and links out to retailers and resale marketplaces — it never sells sneakers or
          holds funds. Some links are affiliate links; CHOSN may earn a commission at no extra cost to you.
        </p>
      </div>
    </footer>
  );
}
