import { Module } from '@nestjs/common';
import { pgPoolProvider } from '../db/db.provider';
import { PricingModule } from '../pricing/pricing.module';
import { MappingAssistController } from './mapping-assist.controller';
import { MappingAssistService } from './mapping-assist.service';

/**
 * Imports PricingModule for DRIZZLE (same convention as CatalogModule).
 * AdminGuard additionally needs its own PG_POOL — PricingModule exports
 * drizzleProvider but not pgPoolProvider, so this module provides it
 * directly, same fix moderation.module.ts already carries (its own
 * comment: "AdminGuard still needs its own PG_POOL, same as before").
 * Caught by actually booting the API locally against the dev DB, not
 * assumed — the same "boot it for real" step Day 20 skipped.
 */
@Module({
  imports: [PricingModule],
  controllers: [MappingAssistController],
  providers: [pgPoolProvider, MappingAssistService],
})
export class MappingAssistModule {}
