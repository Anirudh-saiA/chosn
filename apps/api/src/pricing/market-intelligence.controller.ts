import { Controller, Get, NotFoundException, Param, ParseUUIDPipe } from '@nestjs/common';
import { MarketIntelligenceService, type MarketIntelligenceSummary } from './market-intelligence.service';

/**
 * The single read Day 10's price comparison UI needs — cache-aside in
 * front of market_summaries, no joins or aggregation in this request
 * path (Day 9 definition of done).
 */
@Controller('market-intelligence')
export class MarketIntelligenceController {
  constructor(private readonly intelligence: MarketIntelligenceService) {}

  @Get(':sneakerVariantId')
  async get(
    @Param('sneakerVariantId', new ParseUUIDPipe()) sneakerVariantId: string,
  ): Promise<MarketIntelligenceSummary> {
    const row = await this.intelligence.getCached(sneakerVariantId);
    if (!row) {
      throw new NotFoundException(
        `No market intelligence computed yet for variant ${sneakerVariantId} — it may be unmapped, or the hourly refresh hasn't run since it was added.`,
      );
    }
    return row;
  }
}
