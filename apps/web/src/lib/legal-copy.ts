/**
 * Single source of truth for the affiliate disclosure (Day 19 task 3).
 *
 * Before today this existed as two independently-written paragraphs —
 * pricing/AffiliateDisclosure.tsx (Day 10, next to the offer table) and
 * landing/LandingFooter.tsx (written later, for the landing page) —
 * which said overlapping but not identical things. Two phrasings of the
 * same policy is exactly what task 3 flags: it reads as three different
 * documents written on three different days, and if the wording ever
 * has to be defended, "which version applies" is a question nobody
 * wants to answer.
 *
 * Both forms below make the same four claims, in the same order, in the
 * same words where they overlap:
 *   1. Some outbound links are affiliate links.
 *   2. CHOSN may earn a commission.
 *   3. It costs the user nothing extra.
 *   4. Prices/stock are the retailer's, set by them, and can change.
 *
 * SHORT drops (4) only because the footer sits on pages with no live
 * price data to be stale — it is a subset of LONG, never a variant of
 * it. The Terms of Service quotes LONG verbatim.
 */

export const AFFILIATE_DISCLOSURE_LONG =
  'Some links on this page are affiliate links. CHOSN may earn a commission if you buy through them, at no extra cost to you. Prices, stock, and shipping are set by each retailer and can change after we last checked.';

export const AFFILIATE_DISCLOSURE_SHORT =
  'Some links are affiliate links. CHOSN may earn a commission if you buy through them, at no extra cost to you.';

/** The "not a marketplace" boundary from Day 1's spec, stated the same way everywhere it appears. */
export const NOT_A_MARKETPLACE =
  'CHOSN compares prices and links out to retailers and resale marketplaces. It never sells sneakers, holds inventory, processes payments, or acts as a party to any transaction.';
