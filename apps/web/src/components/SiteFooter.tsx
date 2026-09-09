import Link from 'next/link';
import { AFFILIATE_DISCLOSURE_SHORT, NOT_A_MARKETPLACE } from '@/lib/legal-copy';

/**
 * Day 19 task 10 requires the legal pages to be reachable "from every
 * page footer" — before today no site-wide footer existed at all (only
 * the landing page had one, from the Day 18 editorial fork), so this is
 * the component that makes that requirement true rather than assumed.
 *
 * Uses the Day 2 design tokens, unlike LandingFooter, which is part of
 * the landing-only ink/bone/ember fork — the two are deliberately
 * separate components for the same reason every other landing/ file is.
 * They share their *copy* through lib/legal-copy.ts; only the styling
 * differs.
 */
export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-moss/20 bg-vault px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          {([
            ['/terms', 'Terms of Service'],
            ['/privacy', 'Privacy Policy'],
            ['/community-guidelines', 'Community Guidelines'],
            ['/transparency', 'Transparency'],
            ['/feedback', 'Send feedback'],
          ] as const).map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="font-mono text-ui-label text-text-soft transition-colors duration-150 ease-chosn hover:text-text"
            >
              {label}
            </Link>
          ))}
        </nav>

        <p className="mt-6 max-w-[80ch] text-meta text-text-faint">
          {NOT_A_MARKETPLACE} {AFFILIATE_DISCLOSURE_SHORT}
        </p>

        <p className="mt-4 text-meta text-text-faint">© {new Date().getFullYear()} CHOSN</p>
      </div>
    </footer>
  );
}
