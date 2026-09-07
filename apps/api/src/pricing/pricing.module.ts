import { Module } from '@nestjs/common';
import { redisProvider } from '../common/redis.provider';
import { pgPoolProvider } from '../db/db.provider';
import { drizzleProvider } from '../db/drizzle.provider';
import { PriceFetchService } from '../queue/price-fetch.service';
import {
  RETAILER_ADAPTER_CLASSES,
  retailerAdaptersProvider,
} from '../retailers/adapter.registry';
import { FetchHealthController } from './fetch-health.controller';
import { FetchHealthService } from './fetch-health.service';
import { PriceSnapshotService } from './price-snapshot.service';

/**
 * The price pipeline: adapters, queues, the snapshot writer, and health.
 *
 * Adding retailer 7, 8, 9 is now: write the adapter, add it to
 * RETAILER_ADAPTER_CLASSES and the registry's inject list, insert a
 * retailers row. Nothing in this module or PriceFetchService changes.
 */
@Module({
  controllers: [FetchHealthController],
  providers: [
    pgPoolProvider,
    redisProvider,
    drizzleProvider,
    ...RETAILER_ADAPTER_CLASSES,
    retailerAdaptersProvider,
    PriceSnapshotService,
    FetchHealthService,
    PriceFetchService,
  ],
  exports: [PriceFetchService, PriceSnapshotService, FetchHealthService, drizzleProvider],
})
export class PricingModule {}
