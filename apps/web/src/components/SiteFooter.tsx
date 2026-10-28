import Link from 'next/link';
import { AFFILIATE_DISCLOSURE_SHORT, NOT_A_MARKETPLACE } from '@/lib/legal-copy';

/** Feedback opens the visitor's mail app, addressed to the community inbox. */
const FEEDBACK_MAILTO = 'mailto:join.sneakercommunity@gmail.com?subject=CHOSN%20feedback';

const LINK =
  'inline-flex min-h-11 items-center rounded-full text-[0.95rem] font-medium text-white/80 transition-colors duration-200 hover:text-white focus-visible:outline-white';

const COLUMNS = [
  {
    title: 'Explore',
    links: [
      ['/sneakers', 'Compare'],
      ['/brands', 'Brands'],
      ['/price-drops', 'Crazy falls'],
      ['/releases', 'Releases'],
      ['/community', 'Community'],
    ],
  },
  {
    title: 'You',
    links: [
      ['/notifications', 'Notifications'],
      [FEEDBACK_MAILTO, 'Feedback'],
    ],
  },
  {
    title: 'About and legal',
    links: [
      ['/stores', 'Stores we compare'],
      ['/transparency', 'Transparency'],
      ['/community-guidelines', 'Guidelines'],
      ['/terms', 'Terms'],
      ['/privacy', 'Privacy'],
    ],
  },
] as const;

/**
 * Site-wide footer (legal pages must be reachable from every page). Black panel with rounded top corners: the wordmark, three short
 * link columns (every link at least 44px tall) and the marketplace/affiliate disclosure kept verbatim from lib/legal-copy.ts in small print.
 */
export function SiteFooter() {
  return (
    <footer className="relative mt-20 overflow-hidden rounded-t-[28px] bg-[#0A0A0A] text-white sm:rounded-t-[36px]">
      <div className="mx-auto max-w-[90rem] px-5 pb-8 pt-12 sm:px-8 sm:pt-16">
        <div className="grid gap-10 sm:grid-cols-[1.2fr_2fr]">
          <div>
            <p className="font-display text-[2.5rem] font-extrabold leading-none tracking-[-0.04em] sm:text-[3.5rem]">CHOSN</p>
            <p className="mt-3 max-w-xs text-[0.95rem] leading-relaxed text-white/70">Every sneaker price in India, side by side. We never sell, we send you to the best price.</p>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-3">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h2 className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-white/55">{col.title}</h2>
                <ul className="mt-2">
                  {col.links.map(([href, label]) => (
                    <li key={href}>
                      {href.startsWith('mailto:') ? (
                        <a href={href} className={LINK}>
                          {label}
                        </a>
                      ) : (
                        <Link href={href} className={LINK}>
                          {label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/15 pt-6 sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-[72ch] text-[0.78rem] leading-relaxed text-white/65">
            {NOT_A_MARKETPLACE} {AFFILIATE_DISCLOSURE_SHORT}
          </p>
          <p className="shrink-0 text-[0.78rem] font-semibold text-white/65">© {new Date().getFullYear()} CHOSN</p>
        </div>
      </div>
    </footer>
  );
}
