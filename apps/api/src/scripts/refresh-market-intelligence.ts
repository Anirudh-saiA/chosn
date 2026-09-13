/**
 * Manual trigger — recomputes market_summaries for every sneaker variant
 * immediately, instead of waiting for the hourly scheduled refresh
 * (MarketIntelligenceService's own "every 60m" cron). Same rationale as
 * fetch-once.ts: a script run through Railway's Console, not an HTTP
 * endpoint — this reads across the whole catalog, no reason to expose
 * it publicly when the existing internal schedule already covers the
 * normal case.
 *
 *   npm run mi:refresh-now --workspace=@chosn/api
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { MarketIntelligenceService } from '../pricing/market-intelligence.service';

async function main() {
  const logger = new Logger('refresh-market-intelligence');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'warn', 'error'] });
  try {
    const mi = app.get(MarketIntelligenceService);
    const result = await mi.refreshAll();
    logger.log(`refreshAll: ${result.processed} processed, ${result.failed} failed`);
  } finally {
    await app.close();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
