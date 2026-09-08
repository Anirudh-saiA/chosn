import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { DropHealthController } from './drop-health.controller';
import { DropHealthService } from './drop-health.service';
import { DropNewsAutoPostService } from './drop-news-auto-post.service';
import { DropSchedulerService } from './drop-scheduler.service';

/**
 * The "instant" drops pipeline (Day 12 design → Day 13 build): the
 * scheduler that flips DropEvent status and publishes drop:live, and
 * the news-feed auto-post consumer that subscribes to it. Day 14 adds
 * the WebSocket and web-push consumers as more providers here — the
 * scheduler itself doesn't change when they're added, which is the
 * whole point of the pub/sub split.
 *
 * Imports PricingModule for `DRIZZLE`/the pg Pool rather than
 * re-declaring pgPoolProvider here — same reasoning CatalogModule's own
 * doc comment gives: each module that declares pgPoolProvider directly
 * (WaitlistModule, PricingModule) gets its own separate `new Pool()`,
 * since Nest's DI is per-module, not deduped by injection token across
 * the app. A third module independently opening a third pool is a real
 * connection-count cost, not a free re-declaration — reuse the existing
 * one instead.
 */
@Module({
  imports: [PricingModule],
  controllers: [DropHealthController],
  providers: [DropSchedulerService, DropNewsAutoPostService, DropHealthService],
  exports: [DropSchedulerService],
})
export class DropsModule {}
