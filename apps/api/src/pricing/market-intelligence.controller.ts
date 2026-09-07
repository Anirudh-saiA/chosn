import { Controller, Get, NotFoundException, Param, ParseUUIDPipe } from '@nestjs/common';
import { MarketIntelligenceCacheService } from './market-intelligence-cache.service';
import { MarketIntelligenceService, type MarketIntelligenceSummary } from './market-intelligence.service';

/**
 * The single read Day 10's price comparison UI needs — cache-aside in
 * front of market_summaries, no joins or aggregation in this request
 * path (Day 9 definition of done). `source` is included so a cache miss
 * is visible during development rather than indistinguishable from a hit.
 */
@Controller('market-intelligence')
export class MarketIntelligenceController {
  constructor(
    private readonly intelligence: MarketIntelligenceService,
    private readonly cache: MarketIntelligenceCacheService,
  ) {}

  @Get(':sneakerVariantId')
  async get(
    @Param('sneakerVariantId', new ParseUUIDPipe()) sneakerVariantId: string,
  ): Promise<MarketIntelligenceSummary & { source: 'cache' | 'db' }> {
    const cached = await this.cache.get(sneakerVariantId);
    if (cached) return { ...cached, source: 'cache' };

    const row = await this.intelligence.get(sneakerVariantId);
    if (!row) {
      throw new NotFoundException(
        `No market intelligence computed yet for variant ${sneakerVariantId} — it may be unmapped, or the hourly refresh hasn't run since it was added.`,
      );
    }

    await this.cache.set(sneakerVariantId, row); // warm it so the next request is a hit
    return { ...row, source: 'db' };
  }
}
