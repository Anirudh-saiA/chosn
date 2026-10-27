/**
 * The footwear-type rule (migration 0050): slides, sandals and boots/other are hidden from every public read.
 * The database function classify_footwear() is the real rule (it runs on every insert and rename); this file holds the same
 * patterns so the rule can be tested without a database. footwear-type.spec.ts reads the migration and fails if they drift.
 * PostgreSQL's \m and \M (start and end of a word) are \b in JavaScript.
 */
export type FootwearType = 'sneaker' | 'slide' | 'sandal' | 'other';

export const FOOTWEAR_PATTERNS: ReadonlyArray<readonly [FootwearType, string]> = [
  ['sneaker', 'sneakers?'],
  ['sandal', '(sandals?|sandalen|gladiators?)'],
  ['slide', '(flip[ -]?flops?|slides?|sliders?|slippers?|thongs?|floaters?|mules?|clogs?|adilette)'],
  ['other', '(boots?|loafers?|derby|chukkas?|heels?|socks?|bags?|backpacks?|hats?|shirts?|hoodies?|jackets?|shorts)'],
];

/** First matching pattern wins; anything unsure stays a sneaker, because hiding a real sneaker is worse than showing one odd sandal. */
export function classifyFootwear(model: string | null | undefined, silhouette?: string | null): FootwearType {
  const text = `${model ?? ''} ${silhouette ?? ''}`;
  for (const [type, pattern] of FOOTWEAR_PATTERNS) {
    if (new RegExp(`\\b${pattern}\\b`, 'i').test(text)) return type;
  }
  return 'sneaker';
}
