import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

/**
 * Read-only catalog access for the price comparison page (Day 10).
 * Imports PricingModule rather than re-providing drizzle/redis — the
 * Market Intelligence data this depends on already lives there, and
 * duplicating those providers would mean two separate DB pools.
 */
@Module({
  imports: [PricingModule],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
