import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../common/redis.provider';
import type { MarketIntelligenceSummary } from './market-intelligence.service';

const KEY_PREFIX = 'mi:v1:';
/** Matches the hourly refresh cadence — a cached row is never older than one refresh cycle. */
const TTL_SECONDS = 3600;

/**
 * Cache-aside in front of market_summaries (Day 9 task 6). The price
 * page reads this first; Postgres is only touched on a miss, and the
 * hourly refresh writes through so a miss should be rare outside of
 * cold starts and evictions.
 *
 * Fails open on a Redis error: MarketIntelligenceController falls back
 * to Postgres rather than 500ing, the same shape as RateLimitGuard
 * failing open elsewhere in this codebase — a cache outage should
 * degrade latency, not take the price page down.
 */
@Injectable()
export class MarketIntelligenceCacheService {
  private readonly logger = new Logger(MarketIntelligenceCacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private key(variantId: string): string {
    return `${KEY_PREFIX}${variantId}`;
  }

  async get(variantId: string): Promise<MarketIntelligenceSummary | null> {
    try {
      const raw = await this.redis.get(this.key(variantId));
      return raw ? (JSON.parse(raw) as MarketIntelligenceSummary) : null;
    } catch (err) {
      this.logger.warn(`cache read failed for ${variantId}: ${(err as Error).message}`);
      return null;
    }
  }

  async set(variantId: string, summary: MarketIntelligenceSummary): Promise<void> {
    try {
      await this.redis.set(this.key(variantId), JSON.stringify(summary), 'EX', TTL_SECONDS);
    } catch (err) {
      this.logger.warn(`cache write failed for ${variantId}: ${(err as Error).message}`);
    }
  }

  async invalidate(variantId: string): Promise<void> {
    try {
      await this.redis.del(this.key(variantId));
    } catch (err) {
      this.logger.warn(`cache invalidate failed for ${variantId}: ${(err as Error).message}`);
    }
  }
}
