import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { AFFILIATE_DISCLOSURE_SHORT, NOT_A_MARKETPLACE } from '@/lib/legal-copy';

const COLUMNS = [
  {
    title: 'Explore',
    links: [
      ['/sneakers', 'Compare prices'],
      ['/drops', 'Drop calendar'],
      ['/news', 'News'],
      ['/community', 'Community'],
    ],
  },
  {
    title: 'Account',
    links: [
      ['/login', 'Sign in'],
      ['/sign-up', 'Create account'],
      ['/notifications', 'Notifications'],
      ['/account/security', 'Security'],
    ],
  },
  {
    title: 'Trust',
    links: [
      ['/transparency', 'Transparency'],
      ['/community-guidelines', 'Community guidelines'],
      ['/terms', 'Terms of service'],
      ['/privacy', 'Privacy policy'],
    ],
  },
] as const;

/**
 * Site-wide footer (Day 19 requires legal pages reachable from every
 * page). v2: oversized outlined wordmark, three link columns, and the
 * marketplace/affiliate disclosure kept verbatim from lib/legal-copy.ts.
 */
export function SiteFooter() {
  return (
    <footer className="relative mt-32 overflow-hidden border-t border-text/[0.08] bg-vault-deep">
      <div className="mx-auto max-w-[90rem] px-5 pb-10 pt-16 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <Logo />
            <p className="mt-5 max-w-sm text-body text-text-soft">
              Every sneaker price, tracked. We compare — we never sell. When you find the deal, we send you straight to the retailer.
            </p>
            <Link
              href="/feedback"
              className="link-underline mt-6 inline-block font-mono text-ui-label text-brass-bright"
            >
              Send us feedback →
            </Link>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h2 className="eyebrow">{col.title}</h2>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map(([href, label]) => (
                    <li key={href}>
                      <Link
                        href={href}
                        className="font-sans text-ui-label text-text-soft transition-colors duration-200 hover:text-text"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <p aria-hidden className="pointer-events-none mt-16 select-none text-center font-display text-[clamp(4rem,19vw,17rem)] font-bold leading-[0.8] tracking-tighter text-outline opacity-60">
          CHOSN
        </p>

        <div className="mt-8 flex flex-col gap-3 border-t border-text/[0.08] pt-6 sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-[80ch] text-meta text-text-faint">
            {NOT_A_MARKETPLACE} {AFFILIATE_DISCLOSURE_SHORT}
          </p>
          <p className="shrink-0 font-mono text-meta text-text-faint">© {new Date().getFullYear()} CHOSN</p>
        </div>
      </div>
    </footer>
  );
}
