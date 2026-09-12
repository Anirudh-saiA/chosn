import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { MappingAssistController } from './mapping-assist.controller';
import { MappingAssistService } from './mapping-assist.service';

/**
 * Imports PricingModule for DRIZZLE only (same convention as
 * CatalogModule) — this module owns no tables of its own, it writes
 * into retailer_product_mappings via the one shared pg pool.
 */
@Module({
  imports: [PricingModule],
  controllers: [MappingAssistController],
  providers: [MappingAssistService],
})
export class MappingAssistModule {}
