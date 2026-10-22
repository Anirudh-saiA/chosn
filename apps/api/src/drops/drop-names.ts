/**
 * Telling when two drop entries are the same release written differently, so the calendar shows one card. Pure, so it is tested.
 * "Air Force 1 Low 2026 x Oregon Ducks (Oregon Ducks)" and "Oregon Ducks Nike Air Force 1 Low 2026 (Default)" are one release.
 */
const NOISE = new Set(['x', 'default', 'the', 'and', 'nike', 'jordan', 'adidas', 'originals', 'retro', 'og', 'sp', 'se', 'wmns', 'womens', 'mens']);

export function nameTokens(brand: string, model: string, colorway: string): Set<string> {
  const words = `${model} ${colorway}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter((w) => w && !NOISE.has(w));
  return new Set(words);
}

/** Two entries on the same date and brand are the same release when one's distinguishing words are all in the other. */
export function sameRelease(a: { brand: string; model: string; colorway: string; date: string }, b: { brand: string; model: string; colorway: string; date: string }): boolean {
  if (a.date !== b.date || a.brand.toLowerCase() !== b.brand.toLowerCase()) return false;
  const ta = nameTokens(a.brand, a.model, a.colorway);
  const tb = nameTokens(b.brand, b.model, b.colorway);
  if (ta.size === 0 || tb.size === 0) return false;
  const [small, big] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  if (small.size < 3) return false; // too little to be sure
  for (const w of small) if (!big.has(w)) return false;
  return true;
}
