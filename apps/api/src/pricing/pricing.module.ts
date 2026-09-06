import { Module } from '@nestjs/common';
import { redisProvider } from '../common/redis.provider';
import { pgPoolProvider } from '../db/db.provider';
import { drizzleProvider } from '../db/drizzle.provider';
import { PriceFetchService } from '../queue/price-fetch.service';
import { FlipkartAdapter } from '../retailers/flipkart/flipkart.adapter';
import { PriceSnapshotService } from './price-snapshot.service';

/**
 * The price pipeline: adapters, queues, and the snapshot writer.
 *
 * Adapters 2–10 are added to the providers list and to the map in
 * PriceFetchService's constructor — no other wiring changes, which is
 * the point of settling the adapter interface on the first one.
 */
@Module({
  providers: [
    pgPoolProvider,
    redisProvider,
    drizzleProvider,
    PriceSnapshotService,
    FlipkartAdapter,
    PriceFetchService,
  ],
  exports: [PriceFetchService, PriceSnapshotService, drizzleProvider],
})
export class PricingModule {}
