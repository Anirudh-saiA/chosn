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
import { MarketIntelligenceCacheService } from './market-intelligence-cache.service';
import { MarketIntelligenceController } from './market-intelligence.controller';
import { MarketIntelligenceService } from './market-intelligence.service';
import { PriceSnapshotService } from './price-snapshot.service';

/**
 * The price pipeline: adapters, queues, the snapshot writer, health, and
 * (Day 9) the Market Intelligence computation layer that turns those
 * snapshots into current/best/avg/trend/signal.
 *
 * Adding retailer 7, 8, 9 is now: write the adapter, add it to
 * RETAILER_ADAPTER_CLASSES and the registry's inject list, insert a
 * retailers row. Nothing in this module or PriceFetchService changes.
 */
@Module({
  controllers: [FetchHealthController, MarketIntelligenceController],
  providers: [
    pgPoolProvider,
    redisProvider,
    drizzleProvider,
    ...RETAILER_ADAPTER_CLASSES,
    retailerAdaptersProvider,
    PriceSnapshotService,
    FetchHealthService,
    PriceFetchService,
    MarketIntelligenceCacheService,
    MarketIntelligenceService,
  ],
  exports: [
    PriceFetchService,
    PriceSnapshotService,
    FetchHealthService,
    MarketIntelligenceService,
    MarketIntelligenceCacheService,
    drizzleProvider,
  ],
})
export class PricingModule {}
