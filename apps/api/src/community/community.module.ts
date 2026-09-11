import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { RateLimitGuard } from '../common/rate-limit.guard';
import { DropsModule } from '../drops/drops.module';
import { ReputationModule } from '../reputation/reputation.module';
import { TrustSafetyModule } from '../trust-safety/trust-safety.module';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { CommunityNotificationsController } from './community-notifications.controller';
import { CommunityNotificationsService } from './community-notifications.service';
import { CommunityPushConsumer } from './community-push.consumer';
import { PostImagesController } from './post-images.controller';
import { PostImagesService } from './post-images.service';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { StorageService } from './storage.service';
import { UserActivityController } from './user-activity.controller';
import { VotesController } from './votes.controller';
import { VotesService } from './votes.service';

/**
 * Day 21/22's community feature — the generic post-type template
 * (posts/comments/votes/poll_votes/post_images) all four structured
 * post types share. Imports PricingModule for DRIZZLE (reused, not
 * re-declared — see DropsModule's own comment on why a third module
 * opening a third connection pool is a real cost) and
 * MarketIntelligenceService (Price Check's auto-attached card),
 * TrustSafetyModule for BlocksService (feed-level block filtering, the
 * `excludeBlockedContent` gap Day 17 flagged as unbuilt), and (Day 23)
 * ReputationModule for the reputation badge on every post/comment
 * author and the Legit Check posting gate — see PostsService.create
 * and VotesService.cast's own comments on where each is applied — and
 * (Day 24) DropsModule for WebPushService, reused by
 * CommunityPushConsumer rather than a second push-sending wrapper.
 */
@Module({
  imports: [PricingModule, TrustSafetyModule, ReputationModule, DropsModule],
  controllers: [
    PostsController,
    CommentsController,
    VotesController,
    PostImagesController,
    CommunityNotificationsController,
    UserActivityController,
  ],
  providers: [
    RateLimitGuard,
    PostsService,
    CommentsService,
    VotesService,
    PostImagesService,
    StorageService,
    CommunityNotificationsService,
    CommunityPushConsumer,
  ],
})
export class CommunityModule {}
