import { Module } from '@nestjs/common';
import { RateLimitGuard } from '../common/rate-limit.guard';
import { PricingModule } from '../pricing/pricing.module';
import { DropHealthController } from './drop-health.controller';
import { DropHealthService } from './drop-health.service';
import { DropLiveGateway } from './drop-live.gateway';
import { DropNewsAutoPostService } from './drop-news-auto-post.service';
import { DropPushConsumer } from './drop-push.consumer';
import { DropSchedulerService } from './drop-scheduler.service';
import { DropsController } from './drops.controller';
import { NotificationsController } from './notifications/notifications.controller';
import { NotificationsService } from './notifications/notifications.service';
import { WebPushService } from './web-push.service';

/**
 * The "instant" drops pipeline (Day 12 design → Day 13 scheduler/news
 * consumer → Day 14 WebSocket + push consumers, and the subscription
 * management REST API those two now depend on).
 *
 * Three independent consumers of `drop:live` live here now
 * (DropNewsAutoPostService, DropLiveGateway, DropPushConsumer) — each
 * owns its own Redis subscriber connection and its own failure
 * isolation, and none of them changed when the other two were added,
 * which was the actual point of the pub/sub split back in Day 12.
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
  controllers: [DropHealthController, DropsController, NotificationsController],
  providers: [
    RateLimitGuard,
    DropSchedulerService,
    DropNewsAutoPostService,
    DropHealthService,
    DropLiveGateway,
    WebPushService,
    DropPushConsumer,
    NotificationsService,
  ],
  exports: [DropSchedulerService],
})
export class DropsModule {}
