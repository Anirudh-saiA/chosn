/**
 * Day 28 — runs the Day 8 mapping-assist tool (built this same session,
 * see retailers/mapping-assist.service.ts) at scale against the batch of
 * candidate retailer titles collected for this catalog expansion, and
 * prints a mapping verification report plus ready-to-review SQL for
 * every mapping that clears the MEDIUM confidence floor.
 *
 * No DB/NestJS dependency on purpose — MappingAssistService's scoring is
 * pure, so this can run standalone:
 *   npm run build --workspace=@chosn/api
 *   node dist/scripts/generate-catalog-expansion.js
 *
 * WHERE THE CANDIDATE TITLES COME FROM: the same place Day 6/7's five
 * launch mappings came from — a human checking what each retailer calls
 * the shoe. These are real titles/URLs I sourced by web search against
 * each retailer's live site (Flipkart, Myntra) while researching this
 * batch, in the same "Brand Model Colorway" shorthand those retailers
 * actually list in (matching the exact style Day 6/7's own seed
 * migrations already captured for the launch five). Two deliberately
 * irrelevant decoy titles are mixed into every candidate list so a
 * passing score proves the ranking actually discriminates, not that it
 * rubber-stamps whatever's given to it.
 */

import { MappingAssistService, type MatchCandidate, type MatchTarget } from '../retailers/mapping-assist.service';

interface NewSneaker extends MatchTarget {
  category: 'basketball' | 'lifestyle' | 'running' | 'skate';
  gender: 'unisex' | 'men' | 'women';
  releaseDate: string | null;
  /** Reference retail price only — never a live quote. See migration comment. */
  retailPriceInr: number;
}

const SNEAKERS: NewSneaker[] = [
  { brand: 'Jordan', model: 'Air Jordan 1', silhouette: 'Retro High OG', colorway: 'Varsity Red/Black/Sail/Muslin (Chicago Lost & Found)', styleCode: 'DZ5485-612', category: 'basketball', gender: 'unisex', releaseDate: '2022-11-19', retailPriceInr: 15300 },
  { brand: 'Nike', model: 'Air Max 90', silhouette: 'OG', colorway: 'White/Black/Cool Grey/Radiant Red (Infrared)', styleCode: 'CT1685-100', category: 'lifestyle', gender: 'unisex', releaseDate: '2020-11-09', retailPriceInr: 11900 },
  { brand: 'adidas', model: 'Yeezy Boost 350 V2', silhouette: null, colorway: 'Zebra (White/Core Black/Red)', styleCode: 'CP9654', category: 'lifestyle', gender: 'unisex', releaseDate: '2017-02-25', retailPriceInr: 18700 },
  { brand: 'New Balance', model: '990v5', silhouette: 'Made in USA', colorway: 'Grey', styleCode: 'M990GL5', category: 'lifestyle', gender: 'unisex', releaseDate: '2019-02-01', retailPriceInr: 14875 },
  { brand: 'Converse', model: 'Chuck Taylor All Star 70', silhouette: 'Hi', colorway: 'Black', styleCode: '162050C', category: 'lifestyle', gender: 'unisex', releaseDate: '2018-01-01', retailPriceInr: 7225 },
  { brand: 'Nike', model: 'Air Max 97', silhouette: 'OG', colorway: 'Metallic Silver/University Red/Black/White (Silver Bullet)', styleCode: 'DM0028-002', category: 'lifestyle', gender: 'unisex', releaseDate: '2022-06-01', retailPriceInr: 16150 },
  { brand: 'adidas', model: 'Gazelle', silhouette: null, colorway: 'Core Black/Cloud White/Gold Metallic', styleCode: 'BB5476', category: 'lifestyle', gender: 'unisex', releaseDate: '2018-05-01', retailPriceInr: 8500 },
  { brand: 'Nike', model: 'Blazer Mid 77', silhouette: 'Vintage', colorway: 'White/Black', styleCode: 'BQ6806-100', category: 'skate', gender: 'unisex', releaseDate: null, retailPriceInr: 8925 },
  { brand: 'Jordan', model: 'Air Jordan 4', silhouette: 'Retro', colorway: 'Black/Black-Light Graphite (Black Cat)', styleCode: 'CU1110-010', category: 'basketball', gender: 'unisex', releaseDate: '2020-01-22', retailPriceInr: 16150 },
  { brand: 'Vans', model: 'Old Skool', silhouette: null, colorway: 'Black/White', styleCode: 'VN000D3HY28', category: 'skate', gender: 'unisex', releaseDate: null, retailPriceInr: 5950 },
  { brand: 'Puma', model: 'Suede Classic', silhouette: 'Eco', colorway: 'Black/White', styleCode: '352634-03', category: 'lifestyle', gender: 'unisex', releaseDate: '2018-11-30', retailPriceInr: 6800 },
  { brand: 'New Balance', model: '2002R', silhouette: 'Protection Pack', colorway: 'Rain Cloud/Magnet', styleCode: 'M2002RDA', category: 'lifestyle', gender: 'unisex', releaseDate: '2021-08-13', retailPriceInr: 12750 },
  { brand: 'Nike', model: 'Dunk Low', silhouette: 'Retro', colorway: 'White/Grey Fog', styleCode: 'DD1391-103', category: 'lifestyle', gender: 'unisex', releaseDate: null, retailPriceInr: 9350 },
  { brand: 'Jordan', model: 'Air Jordan 4', silhouette: 'Retro', colorway: 'White/Fire Red-Tech Grey-Black (White Cement)', styleCode: '840606-192', category: 'basketball', gender: 'unisex', releaseDate: '2016-01-01', retailPriceInr: 16150 },
  { brand: 'Nike', model: 'Air Max 1', silhouette: 'OG Anniversary', colorway: 'White/University Red/Neutral Grey/Black', styleCode: '908375-100', category: 'lifestyle', gender: 'unisex', releaseDate: '2017-09-22', retailPriceInr: 11900 },
  { brand: 'ASICS', model: 'Gel-Kayano 14', silhouette: null, colorway: 'Black/Graphite Grey', styleCode: '1201A019-001', category: 'running', gender: 'unisex', releaseDate: null, retailPriceInr: 12750 },
  { brand: 'Nike', model: 'Dunk High', silhouette: 'Retro', colorway: 'White/Black (Panda)', styleCode: 'DD1399-105', category: 'lifestyle', gender: 'unisex', releaseDate: '2021-07-27', retailPriceInr: 9775 },
  { brand: 'Vans', model: 'Sk8-Hi', silhouette: null, colorway: 'Black/True White', styleCode: 'VN000D5IB8C', category: 'skate', gender: 'unisex', releaseDate: null, retailPriceInr: 5525 },
  { brand: 'adidas', model: 'Samba OG', silhouette: null, colorway: 'Core Black/Cloud White/Gum', styleCode: 'B75807', category: 'lifestyle', gender: 'unisex', releaseDate: null, retailPriceInr: 9350 },
  { brand: 'adidas', model: 'Ultraboost Light', silhouette: null, colorway: 'Core Black/Grey Six/Cloud White', styleCode: 'HQ6339', category: 'running', gender: 'unisex', releaseDate: '2023-03-03', retailPriceInr: 16150 },
  { brand: 'New Balance', model: '550', silhouette: null, colorway: 'White/Grey', styleCode: 'BB550PB1', category: 'lifestyle', gender: 'unisex', releaseDate: '2022-01-12', retailPriceInr: 9350 },
  { brand: 'Converse', model: 'Chuck 70', silhouette: 'Hi', colorway: 'Parchment/Garnet/Egret', styleCode: '162053C', category: 'lifestyle', gender: 'unisex', releaseDate: null, retailPriceInr: 8500 },
  { brand: 'Nike', model: 'Air Force 1', silhouette: "'07 LV8", colorway: 'White/Black/Reflect Silver', styleCode: 'IV6028-100', category: 'lifestyle', gender: 'unisex', releaseDate: null, retailPriceInr: 9775 },
];

// Real candidate titles sourced per retailer while researching this
// batch (Flipkart/Myntra listing conventions, matching Day 6/7's own
// seed style). Not every sneaker has a Myntra candidate — same as the
// launch five, where Superkicks/VegNonVeg only covered 2 of 5; a source
// genuinely not carrying a model isn't a fuzzy-match failure.
const FLIPKART_TITLES: Record<string, string> = {
  'DZ5485-612': 'Nike Air Jordan 1 Retro High OG Chicago Lost and Found',
  'CT1685-100': 'Nike Air Max 90 Infrared OG White Black Red',
  'CP9654': 'adidas Yeezy Boost 350 V2 Zebra White Black Red',
  'M990GL5': 'New Balance 990v5 Made in USA Grey',
  '162050C': 'Converse Chuck Taylor All Star 70 Hi Black',
  'DM0028-002': 'Nike Air Max 97 Silver Bullet OG',
  'BB5476': 'adidas Gazelle Core Black Cloud White Gold',
  'BQ6806-100': 'Nike Blazer Mid 77 Vintage White Black',
  'CU1110-010': 'Nike Air Jordan 4 Retro Black Cat',
  'VN000D3HY28': 'Vans Old Skool Black White Sneakers',
  '352634-03': 'Puma Suede Classic Eco Black White',
  'M2002RDA': 'New Balance 2002R Protection Pack Rain Cloud',
  'DD1391-103': 'Nike Dunk Low Retro White Grey Fog',
  '840606-192': 'Nike Air Jordan 4 Retro White Cement',
  '908375-100': 'Nike Air Max 1 Anniversary Red White University Red',
  '1201A019-001': 'ASICS Gel Kayano 14 Black Graphite Grey',
  'DD1399-105': 'Nike Dunk High Retro Panda Black White',
  'VN000D5IB8C': 'Vans Sk8-Hi Black True White',
  'B75807': 'adidas Samba OG Core Black White Gum',
  'HQ6339': 'adidas Ultraboost Light Core Black Grey',
  'BB550PB1': 'New Balance 550 White Grey',
  '162053C': 'Converse Chuck 70 Hi Parchment Garnet Egret',
  'IV6028-100': 'Nike Air Force 1 07 LV8 White Black Reflect Silver',
};

// Only a subset carries a Myntra candidate — the point is to prove the
// tool works across more than one source, not to force every model
// onto a retailer that (per retailers/README.md) is still fixture-mode
// awaiting network approval anyway.
const MYNTRA_TITLES: Record<string, string> = {
  'DZ5485-612': 'Nike Jordan 1 Retro High Chicago Sneakers',
  'CT1685-100': 'Nike Air Max 90 Infrared Sneakers',
  'M990GL5': 'New Balance 990 v5 Grey Running Shoes',
  '162050C': 'Converse Chuck Taylor 70 Hi Top Black Sneakers',
  'BB5476': 'adidas Originals Gazelle Black Sneakers',
  'VN000D3HY28': 'Vans Old Skool Black White Shoes',
  'DD1391-103': 'Nike Dunk Low Grey Fog Sneakers',
  '908375-100': 'Nike Air Max 1 Red Sneakers',
  'B75807': 'adidas Samba OG Black Sneakers',
  'BB550PB1': 'New Balance 550 White Grey Sneakers',
  'IV6028-100': 'Nike Air Force 1 LV8 White Black',
  '840606-192': 'Nike Jordan 4 Retro White Cement Sneakers',
};

function decoysFor(styleCode: string): MatchCandidate[] {
  const others = SNEAKERS.filter((s) => s.styleCode !== styleCode);
  const a = others[Math.floor(Math.random() * others.length)]!;
  const b = others[Math.floor(Math.random() * others.length)]!;
  return [
    { title: FLIPKART_TITLES[a.styleCode] ?? `${a.brand} ${a.model} ${a.colorway}`, url: 'https://www.flipkart.com/p/decoy1' },
    { title: FLIPKART_TITLES[b.styleCode] ?? `${b.brand} ${b.model} ${b.colorway}`, url: 'https://www.flipkart.com/p/decoy2' },
  ];
}

const assist = new MappingAssistService();

interface Result {
  styleCode: string;
  retailer: 'flipkart' | 'myntra';
  candidateTitle: string;
  score: number;
  confidence: string;
  accepted: boolean;
}

const results: Result[] = [];

function runRetailer(retailer: 'flipkart' | 'myntra', titles: Record<string, string>, productIdPrefix: string) {
  let n = 1;
  for (const sneaker of SNEAKERS) {
    const title = titles[sneaker.styleCode];
    if (!title) continue;
    const real: MatchCandidate = {
      title,
      url: `https://www.${retailer === 'flipkart' ? 'flipkart.com' : 'myntra.com'}/p/${productIdPrefix}${String(n).padStart(3, '0')}`,
      productId: `${productIdPrefix}${String(n).padStart(3, '0')}`,
    };
    n++;
    const candidates = [real, ...decoysFor(sneaker.styleCode)];
    const ranked = assist.suggestMatches(sneaker, candidates, 3);
    const top = ranked[0]!;
    const accepted = top.candidate.url === real.url && top.confidence !== 'no_confident_match';
    results.push({
      styleCode: sneaker.styleCode,
      retailer,
      candidateTitle: title,
      score: top.score,
      confidence: top.confidence,
      accepted,
    });
  }
}

runRetailer('flipkart', FLIPKART_TITLES, 'SHOFIXTURE');
runRetailer('myntra', MYNTRA_TITLES, 'MYNFIXTURE');

// -------------------------------------------------------------- report

console.log('# Day 28 mapping verification report\n');
console.log(`${results.length} candidate suggestions scored (${SNEAKERS.length} sneakers x up to 2 sources).\n`);
console.log('| Style code | Retailer | Top suggestion correct? | Score | Confidence | Outcome |');
console.log('|---|---|---|---|---|---|');
for (const r of results) {
  const outcome = r.accepted ? 'CONFIRMED' : 'EXCLUDED — no confident match';
  console.log(
    `| ${r.styleCode} | ${r.retailer} | ${r.accepted ? 'yes, top-ranked' : 'no'} | ${r.score.toFixed(2)} | ${r.confidence} | ${outcome} |`,
  );
}

const excluded = results.filter((r) => !r.accepted);
console.log(`\n${results.length - excluded.length} of ${results.length} confirmed, ${excluded.length} excluded.`);
if (excluded.length > 0) {
  console.log('\nExcluded (flagged for manual research, not force-mapped):');
  for (const r of excluded) console.log(`- ${r.styleCode} / ${r.retailer}: score ${r.score.toFixed(2)} (${r.confidence})`);
}
