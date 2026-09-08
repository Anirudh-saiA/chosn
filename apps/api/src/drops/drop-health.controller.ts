import { Controller, Get } from '@nestjs/common';
import { DropHealthService, type DropConsumerHealth, type DropSchedulerHealth } from './drop-health.service';

@Controller('health')
export class DropHealthController {
  constructor(private readonly health: DropHealthService) {}

  /**
   * Scheduler run history + per-consumer failure counts (task 7) — same
   * shape and same reasoning as GET /health/fetch: read-only, no
   * credentials or user data, so no auth needed, and green here should
   * mean actually healthy rather than merely "hasn't been checked."
   */
  @Get('drops')
  async drops(): Promise<{
    ok: boolean;
    scheduler: DropSchedulerHealth;
    consumers: DropConsumerHealth[];
  }> {
    const [scheduler, consumers] = await Promise.all([
      this.health.schedulerSummary(),
      this.health.consumerSummary(),
    ]);

    const consumersDegraded = consumers.some((c) => c.failures24h > 0);
    return { ok: !scheduler.stale && !consumersDegraded, scheduler, consumers };
  }
}
