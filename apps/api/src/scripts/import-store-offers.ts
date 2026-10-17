/**
 * Saves each store's live offers and payment options.
 *
 *   node --env-file=.env dist/scripts/import-store-offers.js offers.json [curated.json]
 *
 * offers.json is what scripts/scrape_store_offers.py read from the stores' banners:
 *   { "<retailer slug>": [{ "text": "...", "url": "...", "kind": "sale" }] }
 * curated.json (default ../../scripts/offers/curated_offers.json) holds offers and payment options that sit behind a
 * store's checkout or were verified by hand:
 *   { "<slug>": { "offers": [{ kind, text, code?, bank?, upTo?, conditions?, url?, source, seenAt, endsOn? }],
 *                 "paymentOptions": [{ kind, label, items[], note?, unavailable?, source?, seenAt? }] } }
 * Both are merged per store. A store listed with an empty scrape and no curated offers has its offers cleared;
 * a store missing from both is left as it was. Offers past their endsOn date are dropped. Needs DATABASE_URL.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';

const KINDS = ['sale', 'coupon', 'bank', 'card', 'wallet', 'emi', 'shipping', 'credit', 'info'] as const;
type Kind = (typeof KINDS)[number];

interface StoreOffer {
  kind: Kind;
  text: string;
  code?: string;
  bank?: string;
  upTo?: number;
  conditions?: string;
  url?: string;
  source?: string;
  seenAt?: string;
  endsOn?: string;
}

interface PaymentGroup {
  kind: string;
  label: string;
  items: string[];
  note?: string;
  unavailable?: boolean;
  source?: string;
  seenAt?: string;
}

/** The banner scraper only knows text; give each line a kind so the page can group it. */
function classify(text: string): Kind {
  if (/shipping|delivery/i.test(text)) return 'shipping';
  if (/cashback/i.test(text)) return 'wallet';
  if (/\bcode\b|coupon/i.test(text)) return 'coupon';
  if (/\bemi\b|instal/i.test(text)) return 'emi';
  return 'sale';
}

function clean(o: Partial<StoreOffer>, fallbackSource: string): StoreOffer | null {
  if (typeof o.text !== 'string' || o.text.trim().length === 0) return null;
  const kind = KINDS.includes(o.kind as Kind) ? (o.kind as Kind) : classify(o.text);
  const out: StoreOffer = { kind, text: o.text.trim() };
  for (const k of ['code', 'bank', 'conditions', 'url', 'source', 'seenAt', 'endsOn'] as const) {
    const v = o[k];
    if (typeof v === 'string' && v.length > 0) out[k] = v;
  }
  if (typeof o.upTo === 'number' && Number.isFinite(o.upTo) && o.upTo > 0) out.upTo = o.upTo;
  out.source ??= fallbackSource;
  return out;
}

function readJson<T>(file: string): T | null {
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : null;
}

async function main() {
  const scrapedFile = process.argv[2];
  if (!scrapedFile) {
    console.error('Usage: import-store-offers <offers.json> [curated.json]');
    process.exit(1);
  }
  const curatedFile = process.argv[3] ?? resolve(process.cwd(), '../../scripts/offers/curated_offers.json');
  const scraped = JSON.parse(readFileSync(scrapedFile, 'utf8')) as Record<string, Array<Partial<StoreOffer>>>;
  const curated = readJson<Record<string, { offers?: Array<Partial<StoreOffer>>; paymentOptions?: PaymentGroup[] }>>(curatedFile) ?? {};
  const today = new Date().toISOString().slice(0, 10);

  const slugs = new Set([...Object.keys(scraped), ...Object.keys(curated).filter((s) => !s.startsWith('_'))]);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    for (const slug of slugs) {
      const seen = new Set<string>();
      const merged: StoreOffer[] = [];
      const add = (o: StoreOffer | null) => {
        if (!o || (o.endsOn && o.endsOn < today)) return;
        const key = o.text.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        merged.push(o);
      };
      for (const o of scraped[slug] ?? []) add(clean({ ...o, seenAt: o.seenAt ?? today }, 'Store banner'));
      for (const o of curated[slug]?.offers ?? []) add(clean(o, 'Curated'));
      const offers = merged.slice(0, 24);

      const res = await pool.query('UPDATE retailers SET offers = $1::jsonb, offers_updated_at = now() WHERE slug = $2', [JSON.stringify(offers), slug]);
      let paid = '';
      const options = curated[slug]?.paymentOptions;
      if (res.rowCount && Array.isArray(options) && options.length > 0) {
        const groups = options.filter((g) => g && typeof g.label === 'string' && Array.isArray(g.items));
        await pool.query('UPDATE retailers SET payment_options = $1::jsonb WHERE slug = $2', [JSON.stringify(groups), slug]);
        paid = `, ${groups.length} payment group(s)`;
      }
      console.log(`${slug}: ${res.rowCount ? `${offers.length} offer(s) saved${paid}` : 'no such store'}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
