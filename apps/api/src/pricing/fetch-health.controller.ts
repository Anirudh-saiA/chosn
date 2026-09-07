import { Controller, Get } from '@nestjs/common';
import { FetchHealthService, type RetailerHealth } from './fetch-health.service';

@Controller('health')
export class FetchHealthController {
  constructor(private readonly health: FetchHealthService) {}

  /**
   * Per-retailer pipeline health. Read-only and non-sensitive — it
   * exposes fetch cadence and success counts, never credentials or
   * prices — so it needs no auth, which also means it can be wired to an
   * uptime check later without handing that service a token.
   */
  @Get('fetch')
  async fetch(): Promise<{ ok: boolean; degraded: string[]; retailers: RetailerHealth[] }> {
    const retailers = await this.health.summary();

    // A source is unhealthy if it has gone quiet OR is failing — both, not
    // either. Checking staleness alone reported ok:true while a retailer
    // failed every single fetch, because rows it wrote before it broke
    // kept it looking recent. Monitoring that stays green through an
    // outage is worse than no monitoring, since it is actively trusted.
    const degraded = retailers.filter((r) => r.stale || r.failures24h > 0);
    return { ok: degraded.length === 0, degraded: degraded.map((r) => r.slug), retailers };
  }
}
