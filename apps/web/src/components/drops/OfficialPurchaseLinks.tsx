import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import type { PurchaseLink } from '@/lib/drops';

/**
 * Compliance requirement, made visible rather than just documented: these
 * are official retailer links (CHOSN earns nothing on them) and must never
 * be visually confusable with the affiliate "View Deal" buttons on the
 * price pages. So: full-width outlined rows with an "Official" tag, never
 * the filled brass button style. `rel="noopener"` only, no `sponsored` —
 * that attribute means "paid link", which is true of "View Deal" and false
 * here.
 */
export function OfficialPurchaseLinks({ links }: { links: PurchaseLink[] }) {
  if (links.length === 0) return null;

  return (
    <div className="panel ticks p-5 sm:p-6">
      <p className="eyebrow flex items-center gap-2">
        <ShieldCheck className="h-4 w-4" aria-hidden /> Where to try to buy at retail
      </p>
      <ul className="mt-4 flex flex-col gap-2.5">
        {links.map((link, i) => {
          const name = link.retailer_name ?? new URL(link.url).hostname;
          return (
            <li key={i}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener"
                className="group flex min-h-[56px] items-center justify-between gap-4 border border-text/[0.12] bg-vault-deep/60 px-4 py-3 transition-all duration-300 hover:border-brass/60 hover:bg-vault-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-display text-lg font-semibold text-text">{name}</span>
                  <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-text-faint">
                    Official retailer{link.region ? ` · ${link.region}` : ''}
                  </span>
                </span>
                <span className="flex items-center gap-1.5 font-sans text-ui-label font-semibold text-brass-bright">
                  Open
                  <ArrowUpRight
                    className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none"
                    aria-hidden
                  />
                  <span className="sr-only">(opens in a new tab)</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-meta text-text-faint">
        Official retailer links — CHOSN earns nothing from these.
        Different from the affiliate "View Deal" links on our price
        comparison pages, which do earn CHOSN a commission.
      </p>
    </div>
  );
}
