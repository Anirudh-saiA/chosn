/**
 * "Buy now / Wait" outlook for one shoe in one size. Pure functions: everything the model reads is passed in, so it can be tested.
 *
 * What it is, plainly: a transparent scoring model (version 1), not a black box and not a promise. Each factor adds or removes points
 * from a score between -100 (wait) and +100 (buy now), and every factor that moved the score is shown to the shopper with its reason.
 * The base rates behind the "comparable shoes" factor are learned from CHOSN's own price history (compute-outlook-priors.ts); the
 * factor weights are set by hand for now and should be fitted from outcomes once there are ~90 days of history to fit them on.
 *
 * Evidence it can use, and when:
 *   other stores   today   how far the cheapest store is below the others
 *   store sale     today   the store's own "was" price, when it shows one
 *   stock          today   how few sizes / stores still have it
 *   own history    7+ days its price against its own range, average and recent direction
 *   comparable     any     how often similar shoes (same brand and price band) got cheaper recently
 *   calendar       always  a big sale coming soon (a hint, never a guarantee)
 * With little evidence the answer is "Not enough to call yet", never a confident guess.
 */
export type OutlookVerdict = 'buy_now' | 'wait' | 'fair' | 'unclear';
export type FactorEffect = 'buy' | 'wait' | 'info';

export interface OutlookFactor {
  label: string;
  effect: FactorEffect;
  detail: string;
  points: number;
}

export interface PriceOutlook {
  verdict: OutlookVerdict;
  headline: string;
  score: number;
  confidence: 'low' | 'medium' | 'high';
  factors: OutlookFactor[];
  /** Share of comparable shoes that got at least 5% cheaper over `peerWindowDays`, or null without enough peers. */
  peerDropShare: number | null;
  peerCount: number;
  peerWindowDays: number;
  historyDays: number;
  model: 'v1-scoring';
}

export interface OutlookInput {
  /** Today's cheapest in-stock price for this size (INR, shipping included). Null = not in stock anywhere. */
  bestPrice: number | null;
  /** Cheapest in-stock price at each store for this size. */
  storePrices: number[];
  /** The store's own crossed-out price at the cheapest store, if it shows one. */
  wasPrice: number | null;
  /** Daily best prices for this shoe and size, oldest first. */
  history: Array<{ day: string; price: number; store?: string | null }>;
  storesInStock: number;
  /** Sizes of this shoe in stock anywhere / sizes it has been seen in. */
  sizesInStock: number;
  sizesKnown: number;
  /** Base rates for comparable shoes (same brand and price band), from the nightly priors job. */
  peer: { n: number; dropShare: number; windowDays: number } | null;
  today: Date;
}

const SALES: Array<{ name: string; date: string }> = [
  { name: 'Diwali sales', date: '2026-11-08' },
  { name: 'Black Friday', date: '2026-11-27' },
  { name: 'End-of-year sales', date: '2026-12-26' },
  { name: 'Republic Day sales', date: '2027-01-26' },
];

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const pct = (n: number) => `${Math.abs(Math.round(n * 100))}%`;

export function nextSale(today: Date): { name: string; days: number } | null {
  for (const s of SALES) {
    const days = Math.ceil((Date.parse(`${s.date}T00:00:00+05:30`) - today.getTime()) / 86_400_000);
    if (days >= 0) return { name: s.name, days };
  }
  return null;
}

export function scoreOutlook(i: OutlookInput): PriceOutlook {
  const factors: OutlookFactor[] = [];
  const add = (label: string, points: number, detail: string) =>
    factors.push({ label, points, detail, effect: points > 0 ? 'buy' : points < 0 ? 'wait' : 'info' });
  const days = i.history.length;
  const base = { model: 'v1-scoring' as const, historyDays: days, peerCount: i.peer?.n ?? 0, peerWindowDays: i.peer?.windowDays ?? 0, peerDropShare: i.peer && i.peer.n >= 50 ? i.peer.dropShare : null };

  if (i.bestPrice === null) {
    return { ...base, verdict: 'unclear', headline: 'Not in stock in this size right now.', score: 0, confidence: 'low', factors: [] };
  }
  const price = i.bestPrice;
  let evidence = 0; // how many independent kinds of evidence we had

  // 1. Other stores: is the cheapest store clearly below the rest?
  if (i.storePrices.length >= 2) {
    evidence++;
    const others = [...i.storePrices].sort((a, b) => a - b).slice(1);
    const gap = (median(others) - price) / median(others);
    if (gap >= 0.1) add('Best store is well below the rest', 18, `The cheapest store is ${pct(gap)} below the others' typical price.`);
    else if (gap >= 0.04) add('Best store is a little below the rest', 8, `The cheapest store is ${pct(gap)} below the others.`);
    else add('Stores agree on the price', 0, `${i.storePrices.length} stores are within a few percent of each other.`);
  } else {
    add('Only one store has it', 0, 'With a single store there is nothing to compare against today.');
  }

  // 2. The store's own sale price
  if (i.wasPrice && i.wasPrice > price) {
    evidence++;
    const off = (i.wasPrice - price) / i.wasPrice;
    if (off >= 0.25) add('Already on sale', 10, `The store shows ${pct(off)} off its own price (${inr(i.wasPrice)}). Store sales end without notice.`);
    else if (off >= 0.1) add('Small store discount', 4, `The store shows ${pct(off)} off its own price.`);
  }

  // 3. Its own history (needs a week). If the price jumped only because the cheaper store sold out, that is not a price rise to wait out.
  const lastStore = i.history[days - 1]?.store ?? null;
  const goneStore = lastStore ? i.history.find((h) => h.store && h.store !== lastStore && h.price <= price * 0.85)?.store ?? null : null;
  if (goneStore) {
    add('Cheaper listing sold out', 0, `This shoe was cheaper at ${goneStore} and that listing is gone, so today's price is higher. It is not a rise you can wait out, unless ${goneStore} restocks.`);
  } else if (days >= 7) {
    evidence++;
    const prices = i.history.map((h) => h.price);
    const lo = Math.min(...prices);
    const hi = Math.max(...prices);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    if (hi < lo * 1.05) add('Price has not moved', 0, `Its price has stayed within a few percent for the ${days} days we have tracked, so there is no low or high to compare with yet.`);
    else if (price <= lo * 1.02) add('At its lowest price yet', 28, `This is the lowest price in the ${days} days we have tracked (high was ${inr(hi)}).`);
    else if (price <= avg * 0.92) add('Below its recent average', 20, `${pct((avg - price) / avg)} under its ${days}-day average of ${inr(avg)}.`);
    else if (price >= avg * 1.08) add('Above its recent average', -22, `${pct((price - avg) / avg)} over its ${days}-day average of ${inr(avg)}. It has been cheaper.`);
    else add('Near its usual price', 0, `Within a few percent of its ${days}-day average of ${inr(avg)}.`);
    const first = prices[Math.max(0, prices.length - 8)]!;
    const move = (price - first) / first;
    if (move <= -0.05) add('Recently came down', 6, `Down ${pct(move)} over the last week.`);
    else if (move >= 0.05) add('Recently went up', -8, `Up ${pct(move)} over the last week.`);
  } else {
    add('Short price history', 0, `Only ${days} day${days === 1 ? '' : 's'} of its own price history so far, so its trend is not used yet.`);
  }

  // 4. Comparable shoes
  if (i.peer && i.peer.n >= 50) {
    evidence++;
    const share = i.peer.dropShare;
    const text = `${Math.round(share * 100)} in 100 comparable shoes got at least 5% cheaper over ${i.peer.windowDays} days (${i.peer.n.toLocaleString('en-IN')} tracked).`;
    // Rates measured over only a few days say little about the next few weeks, so they are shown but not scored until a week is covered.
    if (i.peer.windowDays < 7) add('Price moves of similar shoes', 0, `${text} Too short a window to count yet.`);
    else if (share >= 0.2) add('Similar shoes often get cheaper', -12, text);
    else if (share <= 0.06) add('Similar shoes rarely get cheaper', 8, text);
    else add('Similar shoes sometimes get cheaper', 0, text);
  }

  // 5. Stock
  if (i.storesInStock <= 1 && (i.sizesInStock <= 2 || (i.sizesKnown >= 4 && i.sizesInStock / i.sizesKnown <= 0.25))) {
    evidence++;
    add('Running low', 12, `Only ${i.sizesInStock} size${i.sizesInStock === 1 ? '' : 's'} left, at ${i.storesInStock} store${i.storesInStock === 1 ? '' : 's'}.`);
  }

  // 6. Calendar
  const sale = nextSale(i.today);
  if (sale && sale.days <= 30) add(`${sale.name} are close`, -10, `${sale.name} start in about ${sale.days} day${sale.days === 1 ? '' : 's'}. Stores often cut prices then, but not on every shoe.`);

  const score = Math.max(-100, Math.min(100, factors.reduce((n, f) => n + f.points, 0)));
  const confidence: PriceOutlook['confidence'] = days >= 14 && (i.peer?.n ?? 0) >= 200 ? 'high' : days >= 7 || (evidence >= 3 && (i.peer?.n ?? 0) >= 100) ? 'medium' : 'low';

  let verdict: OutlookVerdict = score >= 25 ? 'buy_now' : score <= -20 ? 'wait' : 'fair';
  if (evidence < 2) verdict = 'unclear';
  const headline =
    verdict === 'buy_now' ? 'Good price to buy now.'
    : verdict === 'wait' ? 'Worth waiting if you can.'
    : verdict === 'fair' ? 'A fair price: no strong reason to rush or wait.'
    : 'Not enough to call yet.';
  return { ...base, verdict, headline, score, confidence, factors };
}
