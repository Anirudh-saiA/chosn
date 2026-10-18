/**
 * CSV price import from the command line, for when the admin web page isn't
 * reachable (it needs a signed-in admin account). Same code path as the
 * admin page: validates every row first and writes nothing if any row is bad.
 *
 *   npm run import:prices --workspace=@chosn/api -- prices.csv            # check only (dry run)
 *   npm run import:prices --workspace=@chosn/api -- prices.csv --save     # actually import
 *
 * With --mark-missing (daily updates): after a successful import, every in-stock listing at a store that was
 * just refreshed (500+ prices written this run) but NOT seen in this file is recorded as out of stock, so a
 * shoe that disappears from a store stops showing as buyable. Append-only: it adds a new snapshot per listing.
 *
 * A file bigger than the admin page's limit (2000 rows) is split into chunks and imported in order; the
 * Compare summaries are recomputed once at the end instead of after every chunk. Needs DATABASE_URL /
 * REDIS_URL set, like the API itself.
 */
import { readFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { sql } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { MarketIntelligenceService } from '../pricing/market-intelligence.service';
import { MAX_ROWS } from '../pricing/price-import/price-csv';
import { PriceImportService, type ImportSummary } from '../pricing/price-import/price-import.service';
import { PriceSnapshotService } from '../pricing/price-snapshot.service';

async function main() {
  const file = process.argv[2];
  const save = process.argv.includes('--save');
  const markMissing = process.argv.includes('--mark-missing');
  const startedAt = new Date();
  const secs = () => `${((Date.now() - startedAt.getTime()) / 1000).toFixed(0)}s`;
  if (!file) {
    console.error('Usage: import:prices <file.csv> [--save] [--mark-missing]');
    process.exit(1);
  }

  const csv = readFileSync(file, 'utf8');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['warn', 'error'] });
  try {
    const service = app.get(PriceImportService);
    const [header = '', ...body] = csv.split(/\r?\n/).filter((l, i) => i === 0 || l.trim() !== '');
    // Splitting on newlines is safe here: scraped fields never contain line breaks (the importer still re-parses each chunk).
    const chunks: string[] = [];
    for (let i = 0; i < body.length; i += MAX_ROWS) chunks.push([header, ...body.slice(i, i + MAX_ROWS)].join('\n'));
    const result: ImportSummary = { dryRun: !save, rowsRead: 0, rowsImported: 0, newSneakers: 0, newVariants: 0, newRetailers: [], pricesRecorded: 0, errors: [], preview: [] };
    for (const [n, chunk] of chunks.entries()) {
      const part = await service.importCsv(chunk, { dryRun: !save, recordedBy: 'csv-import:cli', refresh: false });
      result.rowsRead += part.rowsRead;
      result.rowsImported += part.rowsImported;
      result.newSneakers += part.newSneakers;
      result.newVariants += part.newVariants;
      result.pricesRecorded += part.pricesRecorded;
      result.newRetailers = [...new Set([...result.newRetailers, ...part.newRetailers])];
      result.errors.push(...part.errors.map((e) => ({ ...e, line: e.line + n * MAX_ROWS })));
      console.log(`chunk ${n + 1}/${chunks.length}: ${part.errors.length ? part.errors.length + ' problem(s)' : 'ok'} (${secs()})`);
      if (part.errors.length > 0) break;
    }
    if (save && markMissing && result.errors.length === 0) {
      const db = app.get<Db>(DRIZZLE);
      const { rows: stale } = await db.execute(sql`
        WITH ran AS (
          SELECT retailer_id FROM price_snapshots WHERE fetched_at >= ${startedAt}
          GROUP BY retailer_id HAVING count(*) >= 500
        )
        SELECT ps.sneaker_variant_id, ps.retailer_id, ps.price, ps.shipping_cost, ps.currency, ps.condition,
               ps.price_type, ps.listing_url, ps.image_url
        FROM price_snapshots ps JOIN ran ON ran.retailer_id = ps.retailer_id
        WHERE ps.is_latest = true AND ps.in_stock = true AND ps.fetched_at < ${startedAt}
          AND ps.listing_url NOT LIKE '%FIXTURE%'
      `);
      const snapshots = app.get(PriceSnapshotService);
      await snapshots.recordMany(
        (stale as unknown as Array<Record<string, string | null>>).map((r) => ({
          sneakerVariantId: r.sneaker_variant_id as string,
          retailerId: r.retailer_id as string,
          price: r.price as string,
          shippingCost: r.shipping_cost ?? null,
          currency: r.currency as string,
          condition: r.condition as never,
          priceType: r.price_type as never,
          inStock: false,
          listingUrl: r.listing_url as string,
          imageUrl: r.image_url ?? null,
          authenticityVerified: false,
          fetchedAt: new Date(),
        })),
      );
      console.log(`Marked ${stale.length} listings no longer on the stores as out of stock. (${secs()})`);
    }

    if (save && result.errors.length === 0) {
      console.log('Recomputing Compare summariesâ€¦');
      // --refresh-store=<slug>: a one-store import only needs that store's shoes recomputed (the daily run does them all).
      const only = process.argv.find((a) => a.startsWith('--refresh-store='))?.split('=')[1];
      // Only sizes that got a snapshot in this run (prices + out-of-stock marks); the hourly refresh covers the rest.
      // --refresh-all restores the old full recompute.
      const full = process.argv.includes('--refresh-all');
      await app.get(MarketIntelligenceService).refreshAll(only ? { retailerSlug: only } : full ? {} : { changedSince: startedAt });
      console.log(`Compare summaries recomputed (${secs()})`);
    }

    if (result.errors.length > 0) {
      console.error(`\n${result.errors.length} problem(s). Nothing was saved:`);
      for (const e of result.errors.slice(0, 100)) console.error(`  line ${e.line}: ${e.message}`);
      process.exitCode = 1;
    } else {
      console.log(
        `\n${save ? 'Imported' : 'Checked (dry run, nothing saved)'}: ${result.rowsImported} prices, ` +
          `${result.newSneakers} new sneakers, ${save ? result.newVariants : '?'} new sizes, ` +
          `${result.newRetailers.length} new stores${result.newRetailers.length ? ` (${result.newRetailers.join(', ')})` : ''}.`,
      );
      if (!save) console.log('Run again with --save to import.');
    }
  } finally {
    // Closing the app can hang on the background workers (queues, Redis); the work is already saved, so don't wait forever.
    await Promise.race([app.close(), new Promise((resolve) => setTimeout(resolve, 15_000))]);
  }
  process.exit(process.exitCode ?? 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
