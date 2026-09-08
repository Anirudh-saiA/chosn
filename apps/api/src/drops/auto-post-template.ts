/**
 * The factual, auto-generated announcement a NewsItem gets the instant a
 * drop flips live — the automated half of Day 12's hybrid content
 * strategy. Every sentence here is assembled from real DropEvent /
 * Sneaker columns, nothing invented: a release date, a price, a region
 * list, a purchase link, a raffle deadline. These are facts, not
 * copyrightable expression, which is exactly the category Day 12's
 * legal note says is fine to generate freely — see drops/README.md.
 *
 * What this deliberately is NOT: the human-authored original write-up
 * Day 12 committed to for the launch-catalog's top models. There is no
 * human in the loop at the instant a drop goes live — "instant" is the
 * whole point of this pipeline — so `source: 'CHOSN (auto)'` marks this
 * post as machine-generated, honestly, rather than presenting it as
 * editorial content nobody wrote. A richer human write-up can publish
 * alongside or after it later (a separate news_items row, is_breaking
 * false) — same "never blend the two" discipline the README already
 * applies to source/source_url.
 */

export interface AutoPostInput {
  brand: string;
  model: string;
  colorway: string;
  styleCode: string;
  regions: string[];
  retailPrice: string | null;
  currency: string;
  purchaseLinks: unknown;
  raffleInfo: unknown;
}

interface PurchaseLink {
  retailer_name?: string;
  url?: string;
}

interface RaffleInfo {
  registration_url?: string;
  registration_closes_at?: string;
  method?: string;
}

const REGION_LABELS: Record<string, string> = {
  india: 'India',
  us: 'the US',
  global: 'globally',
};

function formatPrice(value: string | null, currency: string): string | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  // en-IN grouping regardless of currency symbol — INR is the only
  // currency drop_events carries today (see drops/README.md's Day 12
  // note on the catalog being India-first); revisit if a non-INR drop
  // is ever seeded.
  const formatted = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(
    Math.round(n),
  );
  return currency === 'INR' ? `₹${formatted}` : `${currency} ${formatted}`;
}

function formatRegions(regions: string[]): string {
  if (regions.length === 0) return '';
  const labels = regions.map((r) => REGION_LABELS[r] ?? r);
  if (labels.length === 1) return labels[0] ?? '';
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1] ?? ''}`;
}

function parsePurchaseLinks(raw: unknown): PurchaseLink[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (l): l is PurchaseLink => typeof l === 'object' && l !== null && typeof (l as PurchaseLink).url === 'string',
  );
}

function parseRaffleInfo(raw: unknown): RaffleInfo | null {
  if (typeof raw !== 'object' || raw === null) return null;
  return raw as RaffleInfo;
}

export function buildAutoPostCopy(input: AutoPostInput): { title: string; body: string } {
  const name = `${input.brand} ${input.model} "${input.colorway}"`;
  const title = `${name} is live now`;

  const sentences: string[] = [];

  const regionText = formatRegions(input.regions);
  sentences.push(
    regionText
      ? `The ${name} (${input.styleCode}) just went live in ${regionText}.`
      : `The ${name} (${input.styleCode}) just went live.`,
  );

  const price = formatPrice(input.retailPrice, input.currency);
  if (price) sentences.push(`Retail price: ${price}.`);

  const raffle = parseRaffleInfo(input.raffleInfo);
  if (raffle?.registration_url) {
    const method = raffle.method ? ` via ${raffle.method}` : '';
    const closes = raffle.registration_closes_at
      ? ` Registration closes ${new Date(raffle.registration_closes_at).toUTCString()}.`
      : '';
    sentences.push(`This is a raffle release${method} — enter at ${raffle.registration_url}.${closes}`);
  } else {
    const links = parsePurchaseLinks(input.purchaseLinks);
    if (links.length > 0) {
      const linkText = links
        .map((l) => (l.retailer_name ? `${l.retailer_name} (${l.url})` : l.url))
        .join(', ');
      sentences.push(`Where to try to buy at retail: ${linkText}.`);
    }
  }

  return { title, body: sentences.join(' ') };
}
