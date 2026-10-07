import Link from 'next/link';
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
    <footer className="relative mt-24 overflow-hidden bg-vault-deep">
      <div className="relative mx-auto flex min-h-[40rem] max-w-[90rem] flex-col items-center justify-center px-5 py-20 sm:px-8">
        {/* outline-only wordmark, centred behind everything */}
        <div
          aria-hidden
          className="logo-mask pointer-events-none absolute left-1/2 top-1/2 w-[min(94vw,76rem)] -translate-x-1/2 -translate-y-1/2 select-none text-[#0A0A0A]/35"
          style={{ ['--m' as string]: 'url(/images/logo-word-outline.png)', aspectRatio: 5.8 }}
        />

        {/* the content sits right on top of it */}
        <div className="relative z-10 flex w-full flex-col items-center">
          <nav aria-label="Footer" className="grid w-full max-w-3xl grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3">
            {COLUMNS.map((col) => (
              <div key={col.title} className="text-center">
                <h2 className="eyebrow">{col.title}</h2>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map(([href, label]) => (
                    <li key={href}>
                      <Link href={href} className="font-sans text-ui-label font-bold text-[#0A0A0A] transition-opacity duration-200 hover:opacity-60">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className="mt-14 flex flex-col items-center gap-3 text-center">
            <Link href="/feedback" className="link-underline font-mono text-ui-label font-bold text-brass">
              Send us feedback →
            </Link>
            <p className="max-w-[70ch] text-meta font-semibold text-[#0A0A0A]/70">
              {NOT_A_MARKETPLACE} {AFFILIATE_DISCLOSURE_SHORT}
            </p>
            <p className="font-mono text-meta font-semibold text-[#0A0A0A]/70">© {new Date().getFullYear()} CHOSN</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
