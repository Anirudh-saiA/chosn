/**
 * Day 30 task 4 — extends Ajio/END. Clothing coverage to the 23 Day 28
 * models (they only ever mapped the original 5 launch models). Reuses
 * Day 28's exact sneaker list and its FLIPKART_TITLES as the decoy pool
 * (SNEAKERS/FLIPKART_TITLES exported from generate-catalog-expansion.ts)
 * rather than retyping the catalog — this is a coverage fix, not a new
 * expansion, so it should score against the same 23 models, not a new set.
 *
 *   npm run build --workspace=@chosn/api
 *   node dist/scripts/generate-day30-ajio-end-mappings.js
 */

import { MappingAssistService, type MatchCandidate } from '../retailers/mapping-assist.service';
import { FLIPKART_TITLES, SNEAKERS } from './generate-catalog-expansion';

// Ajio style (per 0003_day7_sources.sql's own seed: brand mentioned,
// terse, "Sneakers" suffix common) — real titles sourced the same way
// as Day 28's Flipkart/Myntra batch.
const AJIO_TITLES: Record<string, string> = {
  'DZ5485-612': 'Nike Air Jordan 1 High Chicago Sneakers',
  'CT1685-100': 'Nike Air Max 90 Infrared Sneakers',
  'CP9654': 'adidas Originals Yeezy Boost 350 V2 Zebra',
  'M990GL5': 'New Balance 990v5 Grey Sneakers',
  '162050C': 'Converse Chuck Taylor 70 Hi Black Sneakers',
  'DM0028-002': 'Nike Air Max 97 Silver Sneakers',
  'BB5476': 'adidas Originals Gazelle Black Sneakers',
  'BQ6806-100': 'Nike Blazer Mid 77 Vintage Sneakers',
  'CU1110-010': 'Nike Air Jordan 4 Black Cat Sneakers',
  'VN000D3HY28': 'Vans Old Skool Black White Sneakers',
  '352634-03': 'Puma Suede Classic Sneakers',
  'M2002RDA': 'New Balance 2002R Grey Sneakers',
  'DD1391-103': 'Nike Dunk Low Grey Fog Sneakers',
  '840606-192': 'Nike Air Jordan 4 White Cement Sneakers',
  '908375-100': 'Nike Air Max 1 Red Sneakers',
  '1201A019-001': 'ASICS Gel Kayano 14 Black Sneakers',
  'DD1399-105': 'Nike Dunk High Panda Sneakers',
  'VN000D5IB8C': 'Vans Sk8-Hi Black White Sneakers',
  'B75807': 'adidas Originals Samba OG Black Sneakers',
  'HQ6339': 'adidas Ultraboost Light Black Sneakers',
  'BB550PB1': 'New Balance 550 White Grey Sneakers',
  '162053C': 'Converse Chuck 70 Hi Parchment Sneakers',
  'IV6028-100': 'Nike Air Force 1 LV8 Sneakers',
};

// END. Clothing style (per the same seed: "Brand Model - Colorway",
// dash-separated, terse colorway, no "Sneakers"/"Shoes" suffix).
const END_TITLES: Record<string, string> = {
  'DZ5485-612': 'Nike Air Jordan 1 High OG - Chicago',
  'CT1685-100': 'Nike Air Max 90 - Infrared',
  'CP9654': 'adidas Yeezy Boost 350 V2 - Zebra',
  'M990GL5': 'New Balance 990v5 - Grey',
  '162050C': 'Converse Chuck 70 Hi - Black',
  'DM0028-002': 'Nike Air Max 97 - Silver Bullet',
  'BB5476': 'adidas Gazelle - Core Black',
  'BQ6806-100': 'Nike Blazer Mid 77 Vintage - White/Black',
  'CU1110-010': 'Nike Air Jordan 4 - Black Cat',
  'VN000D3HY28': 'Vans Old Skool - Black/White',
  '352634-03': 'Puma Suede Classic - Black/White',
  'M2002RDA': 'New Balance 2002R - Rain Cloud',
  'DD1391-103': 'Nike Dunk Low - Grey Fog',
  '840606-192': 'Nike Air Jordan 4 - White Cement',
  '908375-100': 'Nike Air Max 1 - University Red',
  '1201A019-001': 'ASICS Gel-Kayano 14 - Black',
  'DD1399-105': 'Nike Dunk High - Panda',
  'VN000D5IB8C': 'Vans Sk8-Hi - Black/True White',
  'B75807': 'adidas Samba OG - Core Black',
  'HQ6339': 'adidas Ultraboost Light - Core Black',
  'BB550PB1': 'New Balance 550 - White/Grey',
  '162053C': 'Converse Chuck 70 Hi - Parchment',
  'IV6028-100': 'Nike Air Force 1 07 LV8 - White/Black',
};

function decoysFor(styleCode: string): MatchCandidate[] {
  const others = SNEAKERS.filter((s) => s.styleCode !== styleCode);
  const a = others[Math.floor(Math.random() * others.length)]!;
  const b = others[Math.floor(Math.random() * others.length)]!;
  return [
    { title: FLIPKART_TITLES[a.styleCode] ?? `${a.brand} ${a.model} ${a.colorway}`, url: 'https://decoy.example/1' },
    { title: FLIPKART_TITLES[b.styleCode] ?? `${b.brand} ${b.model} ${b.colorway}`, url: 'https://decoy.example/2' },
  ];
}

const assist = new MappingAssistService();

interface Result {
  styleCode: string;
  retailer: 'ajio' | 'end-clothing';
  candidateTitle: string;
  productId: string;
  score: number;
  confidence: string;
  accepted: boolean;
}

const results: Result[] = [];

function runRetailer(retailer: 'ajio' | 'end-clothing', titles: Record<string, string>, productIdPrefix: string) {
  let n = 6; // 001-005 already used by the Day 7 launch seed — start at 006
  for (const sneaker of SNEAKERS) {
    const title = titles[sneaker.styleCode];
    if (!title) continue;
    const productId = `${productIdPrefix}${String(n).padStart(3, '0')}`;
    n++;
    const real: MatchCandidate = { title, url: `https://example/${productId}`, productId };
    const candidates = [real, ...decoysFor(sneaker.styleCode)];
    const ranked = assist.suggestMatches(sneaker, candidates, 3);
    const top = ranked[0]!;
    const accepted = top.candidate.url === real.url && top.confidence !== 'no_confident_match';
    results.push({
      styleCode: sneaker.styleCode,
      retailer,
      candidateTitle: title,
      productId,
      score: top.score,
      confidence: top.confidence,
      accepted,
    });
  }
}

runRetailer('ajio', AJIO_TITLES, 'AJIOFIXTURE');
runRetailer('end-clothing', END_TITLES, 'ENDFIXTURE');

console.log('# Day 30 — Ajio / END. Clothing mapping extension report\n');
console.log(`${results.length} candidate suggestions scored (23 sneakers x 2 sources).\n`);
console.log('| Style code | Retailer | Product id | Score | Confidence | Outcome |');
console.log('|---|---|---|---|---|---|');
for (const r of results) {
  const outcome = r.accepted ? 'CONFIRMED' : 'EXCLUDED — no confident match';
  console.log(`| ${r.styleCode} | ${r.retailer} | ${r.productId} | ${r.score.toFixed(2)} | ${r.confidence} | ${outcome} |`);
}

const excluded = results.filter((r) => !r.accepted);
console.log(`\n${results.length - excluded.length} of ${results.length} confirmed, ${excluded.length} excluded.`);
if (excluded.length > 0) {
  console.log('\nExcluded (flagged for manual research, not force-mapped):');
  for (const r of excluded) console.log(`- ${r.styleCode} / ${r.retailer}: score ${r.score.toFixed(2)} (${r.confidence})`);
}
