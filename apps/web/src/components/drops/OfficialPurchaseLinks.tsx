import type { PurchaseLink } from '@/lib/drops';

/**
 * Day 12's compliance requirement, made visible rather than just
 * documented: these are official retailer links (CHOSN earns nothing on
 * them) and must never be visually confusable with the affiliate "View
 * Deal" buttons on the price comparison pages. Deliberately not
 * `buttonVariantClass` at all — no filled brass, no bordered pill,
 * plain underlined text links in a labeled list — so the two link
 * types can never be mistaken for each other even at a glance, not just
 * on close reading. `rel="noopener"` only, no `sponsored` — that
 * attribute exists specifically to tell search engines "this link was
 * paid for," which is true of "View Deal" and false here.
 */
export function OfficialPurchaseLinks({ links }: { links: PurchaseLink[] }) {
  if (links.length === 0) return null;

  return (
    <div className="border border-moss/25 bg-vault-raised p-5 sm:p-6">
      <p className="font-mono text-meta uppercase tracking-[0.08em] text-text-faint">
        Where to try to buy at retail
      </p>
      <ul className="mt-3 flex flex-col gap-3">
        {links.map((link, i) => (
          <li key={i}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 font-sans text-body font-medium text-text underline decoration-moss underline-offset-4 transition-colors duration-150 ease-chosn hover:text-brass hover:decoration-brass"
            >
              {link.retailer_name ?? new URL(link.url).hostname}
              <span aria-hidden="true">↗</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-meta text-text-faint">
        Official retailer links — CHOSN earns nothing from these.
        Different from the affiliate "View Deal" links on our price
        comparison pages, which do earn CHOSN a commission.
      </p>
    </div>
  );
}
