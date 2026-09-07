/**
 * Day 10 task 8: visible near the offer table, not buried in a footer
 * link. Plain and direct, matching Day 1's "never a marketplace"
 * positioning — CHOSN routes out via these links, it doesn't sell
 * anything itself.
 */
export function AffiliateDisclosure() {
  return (
    <p className="mt-3 max-w-[70ch] text-meta text-text-faint">
      Some links above are affiliate links. CHOSN may earn a commission if you buy through
      them, at no extra cost to you. Prices, stock, and shipping are set by each retailer and
      can change after we last checked.
    </p>
  );
}
