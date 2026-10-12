/**
 * CSV price import from the command line, for when the admin web page isn't
 * reachable (it needs a signed-in admin account). Same code path as the
 * admin page: validates every row first and writes nothing if any row is bad.
 *
 *   npm run import:prices --workspace=@chosn/api -- prices.csv            # check only (dry run)
 *   npm run import:prices --workspace=@chosn/api -- prices.csv --save     # actually import
 *
 * Needs DATABASE_URL / REDIS_URL set, like the API itself.
 */
import { readFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PriceImportService } from '../pricing/price-import/price-import.service';

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
    const result = await app.get(PriceImportService).importCsv(csv, { dryRun: !save, recordedBy: 'csv-import:cli' });

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
