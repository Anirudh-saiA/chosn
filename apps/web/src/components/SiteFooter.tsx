import Link from 'next/link';
import { AFFILIATE_DISCLOSURE_SHORT, NOT_A_MARKETPLACE } from '@/lib/legal-copy';

/** Feedback opens the visitor's mail app, addressed to the community inbox. */
const FEEDBACK_MAILTO = 'mailto:join.sneakercommunity@gmail.com?subject=CHOSN%20feedback';

const LINK = 'font-display text-[1.15rem] uppercase tracking-[0.12em] text-[#0A0A0A] transition-opacity duration-200 hover:opacity-50';

const COLUMNS = [
  [
    ['/sneakers', 'Compare'],
    ['/drops', 'Drops'],
    ['/news', 'News'],
    ['/community', 'Community'],
  ],
  [
    ['/notifications', 'Notifications'],
    [FEEDBACK_MAILTO, 'Feedback'],
  ],
  [
    ['/transparency', 'Transparency'],
    ['/community-guidelines', 'Guidelines'],
    ['/terms', 'Terms'],
    ['/privacy', 'Privacy'],
  ],
] as const;

/**
 * Site-wide footer (legal pages must be reachable from every page). Minimal:
 * three short link columns, the CHOSN wordmark as an outline-only line of
 * type, and the marketplace/affiliate disclosure kept verbatim from
 * lib/legal-copy.ts in small print.
 */
export function SiteFooter() {
  return (
    <footer className="relative mt-24 overflow-hidden bg-[#dce9f3]">
      <div className="mx-auto max-w-[90rem] px-5 pb-8 pt-10 sm:px-8">
        <div className="relative flex min-h-[26rem] items-center justify-center">
          {/* outline-only wordmark in the hero's display face, orange; the links sit on top of it */}
          <p
            aria-hidden
            className="pointer-events-none absolute inset-0 flex select-none items-center justify-center font-display text-[clamp(5rem,26vw,28rem)] uppercase leading-none tracking-[0.01em] text-transparent [-webkit-text-stroke:2px_#FF7A1A]"
          >
            Chosn
          </p>

          <nav aria-label="Footer" className="relative z-10 grid w-full max-w-3xl grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-3">
            {COLUMNS.map((links, n) => (
              <ul key={n} className="space-y-3 text-center">
                {links.map(([href, label]) => (
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
            ))}
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-[#0A0A0A]/15 pt-6 sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-[72ch] text-[0.75rem] font-semibold leading-relaxed text-[#0A0A0A]/60">
            {NOT_A_MARKETPLACE} {AFFILIATE_DISCLOSURE_SHORT}
          </p>
          <p className="shrink-0 font-mono text-[0.75rem] font-semibold text-[#0A0A0A]/60">© {new Date().getFullYear()} CHOSN</p>
        </div>
      </div>
    </footer>
  );
}
