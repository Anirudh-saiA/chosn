/**
 * CSV price import from the command line, for when the admin web page isn't
 * reachable (it needs a signed-in admin account). Same code path as the
 * admin page: validates every row first and writes nothing if any row is bad.
 *
 *   npm run import:prices --workspace=@chosn/api -- prices.csv            # check only (dry run)
 *   npm run import:prices --workspace=@chosn/api -- prices.csv --save     # actually import
 *
 * A file bigger than the admin page's limit (2000 rows) is split into chunks and imported in order; the
 * Compare summaries are recomputed once at the end instead of after every chunk. Needs DATABASE_URL /
 * REDIS_URL set, like the API itself.
 */
import { readFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { MarketIntelligenceService } from '../pricing/market-intelligence.service';
import { MAX_ROWS } from '../pricing/price-import/price-csv';
import { PriceImportService, type ImportSummary } from '../pricing/price-import/price-import.service';

async function main() {
  const file = process.argv[2];
  const save = process.argv.includes('--save');
  if (!file) {
    console.error('Usage: import:prices <file.csv> [--save]');
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
      console.log(`chunk ${n + 1}/${chunks.length}: ${part.errors.length ? part.errors.length + ' problem(s)' : 'ok'}`);
      if (part.errors.length > 0) break;
    }
    if (save && result.errors.length === 0) {
      console.log('Recomputing Compare summaries…');
      await app.get(MarketIntelligenceService).refreshAll();
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
    await app.close();
  }
  process.exit(process.exitCode ?? 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
