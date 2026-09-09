import Link from 'next/link';
import { AFFILIATE_DISCLOSURE_SHORT, NOT_A_MARKETPLACE } from '@/lib/legal-copy';

/**
 * "Hairline divider, small text links only." Day 19 task 3: the
 * affiliate/marketplace copy now comes from lib/legal-copy.ts rather
 * than being restated in this file's own words — this footer and the
 * price pages' AffiliateDisclosure were saying overlapping but
 * non-identical things, which is exactly the "three phrasings written
 * on three different days" problem that task flags.
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
            <Link href="/terms" className="transition-colors hover:text-ink">
              Terms
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-ink">
              Privacy
            </Link>
            <Link href="/feedback" className="transition-colors hover:text-ink">
              Feedback
            </Link>
          </nav>
          <p className="font-grotesk text-xs text-ink/40">© {new Date().getFullYear()} CHOSN</p>
        </div>
        <p className="mt-6 font-grotesk text-xs text-ink/40">
          {NOT_A_MARKETPLACE} {AFFILIATE_DISCLOSURE_SHORT}
        </p>
      </div>
    </footer>
  );
}
