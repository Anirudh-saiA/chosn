import { Info } from 'lucide-react';
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
    <aside className="mt-4 flex max-w-[80ch] gap-3 border-l-2 border-brass/60 bg-brass/[0.05] px-4 py-3">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-brass-bright" aria-hidden />
      <p className="text-meta leading-relaxed text-text-soft">{AFFILIATE_DISCLOSURE_LONG}</p>
    </aside>
  );
}
