// VegNonVeg is a custom (non-Shopify) store, so there is no /products.json.
// Listing + product pages are server-rendered, so CheerioCrawler is enough (no browser needed).
// Usage: node vegnonveg.mjs [limit=50] [out.csv]
import { CheerioCrawler, Configuration } from 'crawlee';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { toCsv } from './csv.mjs';
import { extractPrice } from './vegnonveg-price.mjs';

const LIMIT = Number(process.argv[2] || 50);
const OUT = process.argv[3] || '../../chosn-vegnonveg-all-prices.csv';
const BASE = 'https://www.vegnonveg.com';
const SKIP = /\b(slide|slides|sandal|flip|clog|sock|lace|cleaner|bag|cap)\b/i;
const CODE_RES = [/\b([A-Z]{1,3}\d{4}-\d{3})\b/, /\b(\d{6}-\d{3})\b/, /\b([A-Z]{2}\d{4})\b/, /\b(\d{6} \d{2})\b/];

// Skip products already captured by an earlier run (pass a CSV path as 3rd arg, default = the top-50 file).
const DONE_CSV = process.argv[4] || '../../chosn-vegnonveg-prices.csv';
const done = new Set();
for (const f of [DONE_CSV, DONE_CSV.replace(/\.csv$/, '-missing-style-code.csv')]) {
  if (existsSync(f) && f !== OUT) for (const l of readFileSync(f, 'utf8').split('\n').slice(1)) { const m = l.match(/https:\/\/www\.vegnonveg\.com\/products\/[^,]+/); if (m) done.add(m[0]); }
}
const DELIVERY = 'Dispatched in 1-2 working days; delivery time depends on courier/pincode';
const soldOut = [];
const listing = []; // product urls in popularity order
const rows = [];
const missing = [];

const config = new Configuration({ persistStorage: false });
const crawler = new CheerioCrawler({
  maxConcurrency: 3,
  maxRequestsPerMinute: 60,
  maxRequestRetries: 3,
  additionalMimeTypes: ['text/html'],
  async requestHandler({ $, request, enqueueLinks, log }) {
    if (request.label === 'LIST') {
      const urls = $('#products a.gt-product-click').map((_, a) => $(a).attr('href')).get();
      const names = $('#products a.gt-product-click').map((_, a) => $(a).attr('data-product')).get();
      urls.forEach((u, i) => {
        let name = '';
        try { name = JSON.parse(names[i]).name; } catch {}
        if (!SKIP.test(name) && !listing.includes(u) && !done.has(u)) listing.push(u);
      });
      log.info(`${request.url} -> ${urls.length} cards, ${listing.length} collected`);
      const page = Number(request.userData.page);
      if (listing.length < LIMIT && urls.length && page < 150) {
        await crawler.addRequests([{ url: `${BASE}/footwear?page=${page + 1}`, label: 'LIST', userData: { page: page + 1 } }]);
      } else {
        await crawler.addRequests(listing.slice(0, LIMIT).map((url) => ({ url, label: 'PRODUCT' })));
      }
      return;
    }

    const ld = JSON.parse($('script[type="application/ld+json"]').first().text() || '{}');
    const brand = ld.brand?.name || '';
    const model = ($('h1.p-name').text().trim() || ld.name || '').replace(new RegExp('^' + brand + '\\s+', 'i'), '');
    const colorway = $('h1.p-name').nextAll('p').first().text().trim();
    const { price, compareAt } = extractPrice($); // price = what the customer pays today; compareAt = the struck-through price
    const info = $('div.flex').filter((_, e) => /Additional Information/i.test($(e).text())).first().text();
    // "Additional Information : <code>" is the style code for every brand (e.g. IO4244-500, 1203B081.103)
    const field = (info.match(/Additional Information\s*:\s*(\S.*)/i) || [])[1]?.trim() || '';
    let style = /^[A-Za-z0-9][A-Za-z0-9 .\-\/]{3,24}$/.test(field) && /\d/.test(field) ? field : '';
    if (!style) for (const rx of CODE_RES) { const m = (ld.description || '').match(rx); if (m) { style = m[1]; break; } }
    const image = (ld.image || '').replace(/\?.*$/, '');
    const sizes = $('.size-box[data-size]').map((_, e) => $(e).attr('data-size').replace(/\s*\(.*\)/, '').trim()).get();

    if (!sizes.length) soldOut.push(request.url); // no size boxes rendered => nothing in stock
    for (const size of sizes) {
      const row = { brand, model, colorway, style_code: style, size, retailer: 'VegNonVeg', price, compare_at_price: compareAt, shipping: '', url: request.url, in_stock: 'yes', image_url: image, size_system: 'uk', condition: 'new', delivery_time: DELIVERY };
      (style ? rows : missing).push(row);
    }
    log.info(`${brand} ${model} ${style || '(no style code)'} ${sizes.length} sizes @ ${price}`);
  },
  failedRequestHandler({ request, log }) { log.error(`failed ${request.url}`); },
}, config);

await crawler.run([{ url: `${BASE}/footwear`, label: 'LIST', userData: { page: 1 } }]);

writeFileSync(OUT, toCsv(rows));
if (missing.length) writeFileSync(OUT.replace(/\.csv$/, '-missing-style-code.csv'), toCsv(missing));
if (soldOut.length) writeFileSync(OUT.replace(/\.csv$/, '-sold-out.txt'), soldOut.join('\n'));
console.log(`${soldOut.length} products with no sizes in stock; ${done.size} already-scraped products skipped`);
console.log(`done: ${rows.length} rows (${new Set(rows.map((r) => r.url)).size} products) -> ${OUT}; ${missing.length} rows missing style code`);
