/**
 * Pure helpers for the news feed: which brands a headline is about, what kind of story it is, whether it is about India, and whether two
 * headlines are the same story. No database here, so all of it is unit-tested (news-logic.spec.ts).
 */

/** Canonical brand name -> the spellings a headline may use. Matched on word boundaries, case-insensitively. */
export const BRAND_ALIASES: Record<string, string[]> = {
  Nike: ['nike', 'nike sb', 'nikelab'],
  Jordan: ['jordan', 'air jordan', 'jumpman'],
  adidas: ['adidas', 'yeezy', 'adidas originals'],
  'New Balance': ['new balance'],
  Puma: ['puma'],
  Reebok: ['reebok'],
  ASICS: ['asics', 'onitsuka tiger'],
  Converse: ['converse'],
  Vans: ['vans'],
  Salomon: ['salomon'],
  Saucony: ['saucony'],
  Hoka: ['hoka'],
  On: ['on running'],
  Mizuno: ['mizuno'],
  Crocs: ['crocs'],
  Birkenstock: ['birkenstock'],
  Timberland: ['timberland'],
  'Under Armour': ['under armour'],
  Fila: ['fila'],
  Skechers: ['skechers'],
  Comet: ['comet'],
  'Gully Labs': ['gully labs'],
  Thaely: ['thaely'],
  "Neeman's": ["neeman's", 'neemans'],
  'Bacca Bucci': ['bacca bucci'],
  Campus: ['campus shoes', 'campus activewear'],
  CHNKS: ['chnks'],
  'Almost Gods': ['almost gods'],
  'Red Tape': ['red tape'],
};

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BRAND_RES = Object.entries(BRAND_ALIASES).map(([brand, names]) => [brand, new RegExp(`(^|[^a-z0-9])(?:${names.map(esc).join('|')})(?:'s|’s)?(?![a-z0-9])`, 'i')] as const);

/** The brands a headline names, in the order they are first mentioned. */
export function detectBrands(text: string): string[] {
  const found: Array<[string, number]> = [];
  for (const [brand, re] of BRAND_RES) {
    const m = re.exec(text);
    if (m) found.push([brand, m.index]);
  }
  return found.sort((a, b) => a[1] - b[1]).map(([b]) => b);
}

export type NewsCategory = 'release' | 'collab' | 'culture' | 'industry';
export const CATEGORIES: NewsCategory[] = ['release', 'collab', 'culture', 'industry'];

const INDUSTRY = /\b(earnings|revenue|profit|sales|ceo|cfo|lawsuit|sues?|tariffs?|layoffs?|stock|shares|quarter|investors?|acquires?|acquisition|ipo|funding|raises|market share|retail(ers)? (expand|expansion|opens?)|stores? (open|opens|opening)|supply chain|factory|price hike)\b/i;
const COLLAB = /\b(collab(oration)?s?|teams? up|partners? with|partnership)\b|\sx\s/i;
const RELEASE = /\b(releases?|released|drops?|dropping|launch(es|ed)?|arrives?|available|restock|re-?issue|returns?|unveils?|debuts?|first look|official images|where to buy|release date|colou?rways?|pack)\b/i;
const CULTURE = /\b(celebrity|celebs?|style|outfit|fashion week|runway|street ?style|wears?|spotted|red carpet|cricketer|rapper|singer|actor|athlete|album|tour|music|film|trend|guide|best|review|how to)\b/i;

/** What kind of story a headline (plus excerpt) is. Industry beats collab beats release beats culture; an unclear one counts as culture. */
export function categorize(text: string): NewsCategory {
  if (INDUSTRY.test(text)) return 'industry';
  if (COLLAB.test(text)) return 'collab';
  if (RELEASE.test(text)) return 'release';
  if (CULTURE.test(text)) return 'culture';
  return 'culture';
}

const INDIA = /\b(india|indian|rs\.?\s?\d|₹|rupees?|bengaluru|bangalore|mumbai|delhi|hyderabad|chennai|kolkata|pune|myntra|superkicks|crepdog|vegnonveg|culture circle|mainstreet|limited edt|bollywood|ipl|kohli|dhoni)\b|₹/i;

/** Whether a story is about India: the country, its cities, rupee prices, Indian stores and brands. */
export function mentionsIndia(text: string, brands: string[] = []): boolean {
  const indian = ['Comet', 'Gully Labs', 'Thaely', "Neeman's", 'Bacca Bucci', 'Campus', 'CHNKS', 'Almost Gods', 'Red Tape'];
  return INDIA.test(text) || brands.some((b) => indian.includes(b));
}

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'is', 'are', 'its', 'it', 'this', 'that', 'new', 'now', 'first', 'look', 'at', 'by', 'from', 'as', 'be', 'adds', 'gets', 'get', 'drops', 'releases', 'release', 'x']);

/** Lower-case word tokens of a headline without filler words; used to compare headlines and to match shoes. */
export function tokens(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[’']s\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/** Whether two headlines are about the same story: most of their distinctive words are shared. */
export function sameStory(a: string, b: string): boolean {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (ta.size < 3 || tb.size < 3) return false;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  const union = ta.size + tb.size - shared;
  const smaller = Math.min(ta.size, tb.size);
  return shared >= 3 && (shared / union >= 0.5 || shared / smaller >= 0.75);
}

export interface DupItem {
  id: string;
  title: string;
  publishedAt: Date;
  source: string;
  /** Our own writing wins over a gathered headline. */
  external: boolean;
}

const WINDOW_MS = 4 * 86_400_000;

/**
 * Groups near-duplicate stories (same story within four days). In each group the keeper is our own writing if there is any, otherwise the
 * earliest item. Returns a map from every non-keeper id to its keeper id.
 */
export function findDuplicates(items: DupItem[]): Map<string, string> {
  const sorted = [...items].sort((a, b) => Number(a.external) - Number(b.external) || a.publishedAt.getTime() - b.publishedAt.getTime());
  const dup = new Map<string, string>();
  const keepers: DupItem[] = [];
  for (const it of sorted) {
    const keeper = keepers.find((k) => Math.abs(k.publishedAt.getTime() - it.publishedAt.getTime()) <= WINDOW_MS && sameStory(k.title, it.title));
    if (keeper) dup.set(it.id, keeper.id);
    else keepers.push(it);
  }
  return dup;
}

export interface ShoeRef {
  brand: string;
  model: string;
}

/**
 * The shoe a headline is about, or null. A shoe matches when its brand is named and every distinctive word of its model appears in the
 * headline (a model needs at least two such words, or one word with a digit, such as "Dunk Low" or "Samba OG"). The longest model wins.
 */
export function matchShoe(title: string, shoes: ShoeRef[]): ShoeRef | null {
  const t = new Set(tokens(title));
  const brands = new Set(detectBrands(title));
  let best: { s: ShoeRef; n: number } | null = null;
  for (const s of shoes) {
    if (!brands.has(s.brand)) continue;
    const m = tokens(s.model).filter((w) => w !== s.brand.toLowerCase());
    if (m.length === 0) continue;
    if (m.length < 2 && !m.some((w) => /\d/.test(w))) continue;
    if (!m.every((w) => t.has(w))) continue;
    if (!best || m.length > best.n) best = { s, n: m.length };
  }
  return best?.s ?? null;
}
