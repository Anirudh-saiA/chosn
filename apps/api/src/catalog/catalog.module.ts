import { Module } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { pgPoolProvider } from '../db/db.provider';
import { PricingModule } from '../pricing/pricing.module';
import { AdminImageController } from './admin-image.controller';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

/**
 * Read-only catalog access for the price comparison page (Day 10), plus
 * (Day 37) the one admin write this module owns: curating
 * sneakers.primary_image_url. Imports PricingModule rather than
 * re-providing drizzle/redis — the Market Intelligence data this
 * depends on already lives there, and duplicating those providers would
 * mean two separate DB pools. AdminGuard additionally needs its own
 * PG_POOL, which PricingModule doesn't export (only drizzleProvider) —
 * provided directly here, same fix community-health/mapping-assist/
 * fetch-trigger's own modules already carry for the identical gap.
 */
@Module({
  imports: [PricingModule],
  controllers: [CatalogController, AdminImageController],
  providers: [CatalogService, pgPoolProvider, AdminGuard],
})
export class CatalogModule {}
