/**
 * Manual trigger — enqueues one fetch cycle for a retailer, waits for the
 * queue to drain, and reports what landed.
 *
 * A script rather than an HTTP endpoint on purpose: the API is public,
 * and an unauthenticated "go fetch everything" route is an obvious way to
 * get the affiliate credentials rate-limited by a stranger.
 *
 *   npm run fetch:once --workspace=@chosn/api -- flipkart
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AppModule } from '../app.module';
import { PriceFetchService } from '../queue/price-fetch.service';
import { bullConnection, priceQueueName } from '../queue/queue.config';

async function main() {
  const retailerSlug = process.argv[2] ?? 'flipkart';
  const logger = new Logger('fetch-once');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const fetcher = app.get(PriceFetchService);

    const queued = await fetcher.enqueueAll(retailerSlug);
    logger.log(`queued ${queued} job(s) for ${retailerSlug}`);

    const queue = new Queue(priceQueueName(retailerSlug), { connection: bullConnection() });
    const deadline = Date.now() + 60_000;

    for (;;) {
      const counts = await queue.getJobCounts('waiting', 'active', 'delayed');
      const outstanding = (counts.waiting ?? 0) + (counts.active ?? 0) + (counts.delayed ?? 0);
      if (outstanding === 0) break;
      if (Date.now() > deadline) {
        logger.warn(`timed out with ${outstanding} job(s) still outstanding`);
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    const final = await queue.getJobCounts('completed', 'failed');
    logger.log(`completed=${final.completed ?? 0} failed=${final.failed ?? 0}`);
    await queue.close();
  } finally {
    await app.close();
  }

  // The pg Pool and ioredis client are plain factory providers, so Nest
  // has no lifecycle hook to close them and the event loop stays alive
  // after the work is done. Fine for the long-running server; for a CLI
  // run it means the command never returns, so exit explicitly.
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
