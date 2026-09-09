import { AFFILIATE_DISCLOSURE_LONG } from '@/lib/legal-copy';

/**
 * Day 10 task 8: visible near the offer table, not buried in a footer
 * link. Plain and direct, matching Day 1's "never a marketplace"
 * positioning — CHOSN routes out via these links, it doesn't sell
 * anything itself.
 *
 * Day 19 task 3: the copy itself moved to lib/legal-copy.ts so this and
 * the site footer state one policy rather than two similar paragraphs.
 */
export function AffiliateDisclosure() {
  return (
    <p className="mt-3 max-w-[70ch] text-meta text-text-faint">{AFFILIATE_DISCLOSURE_LONG}</p>
  );
}
