import { Injectable } from '@nestjs/common';

/**
 * Day 28's "fuzzy-matching assist tool" — retroactively Day 8, since no
 * such tool existed before this. The gap was real: `mapping_confidence`
 * (schema.ts) has carried a `'fuzzy'` enum value since Day 1's canonical
 * schema, and nothing in the codebase ever produced one — every mapping
 * through Day 20 was hand-typed directly into a seed migration (see
 * 0002_seed_flipkart_and_test_set.sql / 0003_day7_sources.sql).
 *
 * WHAT THIS DOES NOT DO: there is no live retailer catalog to crawl —
 * four of six sources still run on fixtures (retailers/README.md), and
 * the two manual sources have no product-search API at all, only the
 * `manual_price_entries` table a human fills in after checking the shop
 * page directly. So this tool doesn't fetch candidates; it *ranks*
 * candidates a human already collected (the raw titles they saw on the
 * retailer's site while researching, exactly the research step Day 6/7
 * already did by hand for the first five models) against our catalog,
 * so confirming 100 titles is "scan a ranked top-3 and click confirm"
 * instead of "read every title character by character." The human
 * confirmation step (mapping-assist.controller.ts's /confirm endpoint)
 * is still mandatory — nothing here writes to retailer_product_mappings
 * on its own.
 */

export interface MatchTarget {
  brand: string;
  model: string;
  /** e.g. "Low Retro", "OG", "00s" — almost always present in a real
   * retailer title ("Nike Dunk Low", "adidas Samba OG"), so leaving it
   * out of the matched text was an early bug in this file: it scored a
   * textbook-correct match as only MEDIUM because the title's "Low
   * Retro" had nothing in the target text to match against. Nullable
   * because sneakers.silhouette itself is nullable (schema.ts). */
  silhouette?: string | null;
  colorway: string;
  styleCode: string;
}

export interface MatchCandidate {
  /** The retailer's own listing title, as seen on the product page. */
  title: string;
  url: string;
  /** The retailer's own product/SKU id, when the listing exposes one. */
  productId?: string;
}

export type MatchConfidence = 'high' | 'medium' | 'no_confident_match';

export interface ScoredCandidate {
  candidate: MatchCandidate;
  score: number;
  confidence: MatchConfidence;
  reasons: string[];
}

// Calibrated against this file's own spec, not arbitrary: HIGH requires
// the title to substantially cover brand+model+silhouette+colorway (a
// title missing even the colorway's informal nickname — "Panda" for
// DD1391-100 — lands at MEDIUM, not HIGH, on purpose: that's a real
// reviewable gap, not something to wave through automatically). MEDIUM's
// floor catches a right-brand, wrong-colorway near-miss (worth a human's
// eyes) while staying above a same-brand-different-model mismatch, which
// scores lower still in the same fixtures.
const HIGH_CONFIDENCE_THRESHOLD = 0.82;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.55;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function bigrams(text: string): string[] {
  const padded = ` ${text} `;
  const grams: string[] = [];
  for (let i = 0; i < padded.length - 1; i++) grams.push(padded.slice(i, i + 2));
  return grams;
}

/**
 * Dice's coefficient over character bigrams — chosen over Levenshtein
 * because retailer titles reorder tokens freely ("Nike Dunk Low Panda"
 * vs "Panda Dunk Low by Nike" should score the same; edit distance
 * would punish the reorder as heavily as a genuine mismatch). No
 * external dependency: this is ~10 lines and the whole scoring function
 * needs to stay a pure, fast, synchronous call so /suggest can run it
 * against dozens of candidates per request without a worker queue.
 */
function diceCoefficient(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const bigramsA = bigrams(a);
  const bigramsB = bigrams(b);
  if (bigramsA.length === 0 || bigramsB.length === 0) return 0;

  const counts = new Map<string, number>();
  for (const g of bigramsA) counts.set(g, (counts.get(g) ?? 0) + 1);

  let matches = 0;
  for (const g of bigramsB) {
    const remaining = counts.get(g) ?? 0;
    if (remaining > 0) {
      matches++;
      counts.set(g, remaining - 1);
    }
  }
  return (2 * matches) / (bigramsA.length + bigramsB.length);
}

function confidenceFor(score: number): MatchConfidence {
  if (score >= HIGH_CONFIDENCE_THRESHOLD) return 'high';
  if (score >= MEDIUM_CONFIDENCE_THRESHOLD) return 'medium';
  return 'no_confident_match';
}

@Injectable()
export class MappingAssistService {
  /**
   * Scores one candidate against one target sneaker. Exported at this
   * granularity (not just the batch form below) because /suggest needs
   * per-reason output for a human reviewer, and the unit tests pin down
   * the scoring contract independent of sorting/top-N behavior.
   */
  scoreCandidate(target: MatchTarget, candidate: MatchCandidate): ScoredCandidate {
    const reasons: string[] = [];
    const titleNorm = normalize(candidate.title);
    const brandNorm = normalize(target.brand);

    // Brand is a hard gate, not a weighted factor: a candidate that
    // doesn't even mention the brand is never a real match regardless of
    // how similar the rest of the string looks (e.g. a generic
    // "Low Top Sneaker White" listing shouldn't score close to a real
    // Nike Dunk just because "low" and "white" both appear).
    const brandTokens = brandNorm.split(' ').filter(Boolean);
    const brandPresent = brandTokens.every((t) => titleNorm.includes(t));
    if (!brandPresent) {
      return { candidate, score: 0, confidence: 'no_confident_match', reasons: ['brand not found in title'] };
    }
    reasons.push('brand matched');

    const styleCodeNorm = normalize(target.styleCode);
    const styleCodeBonus = styleCodeNorm.length > 2 && titleNorm.replace(/ /g, '').includes(styleCodeNorm.replace(/ /g, ''))
      ? 0.15
      : 0;
    if (styleCodeBonus > 0) reasons.push('style code present in title');

    const targetText = normalize(
      `${target.brand} ${target.model} ${target.silhouette ?? ''} ${target.colorway}`,
    );
    const textSimilarity = diceCoefficient(targetText, titleNorm);
    reasons.push(`text similarity ${(textSimilarity * 100).toFixed(0)}%`);

    // Weighted so text similarity dominates (brand alone can't carry a
    // score past MEDIUM) but a style-code hit — the one unambiguous
    // signal available — can push an otherwise-medium match into HIGH.
    const score = Math.min(1, textSimilarity * 0.85 + styleCodeBonus);

    return { candidate, score, confidence: confidenceFor(score), reasons };
  }

  /**
   * Ranks every candidate against one target and returns the top N
   * (default 3, per Day 28 task 2's "top-3 candidate suggestions").
   * Candidates below MEDIUM aren't discarded here — the caller (task 3's
   * "flag no confident match" discipline) decides what to do with an
   * all-low-confidence result; this just ranks honestly.
   */
  suggestMatches(target: MatchTarget, candidates: MatchCandidate[], topN = 3): ScoredCandidate[] {
    return candidates
      .map((c) => this.scoreCandidate(target, c))
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);
  }
}
