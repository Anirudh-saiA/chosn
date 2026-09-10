import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { RateLimitGuard } from '../common/rate-limit.guard';
import { TrustSafetyModule } from '../trust-safety/trust-safety.module';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { PostImagesController } from './post-images.controller';
import { PostImagesService } from './post-images.service';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { VotesController } from './votes.controller';
import { VotesService } from './votes.service';

/**
 * Day 21/22's community feature — the generic post-type template
 * (posts/comments/votes/poll_votes/post_images) all four structured
 * post types share. Imports PricingModule for DRIZZLE (reused, not
 * re-declared — see DropsModule's own comment on why a third module
 * opening a third connection pool is a real cost) and
 * MarketIntelligenceService (Price Check's auto-attached card), and
 * TrustSafetyModule for BlocksService (feed-level block filtering, the
 * `excludeBlockedContent` gap Day 17 flagged as unbuilt).
 */
@Module({
  imports: [PricingModule, TrustSafetyModule],
  controllers: [PostsController, CommentsController, VotesController, PostImagesController],
  providers: [RateLimitGuard, PostsService, CommentsService, VotesService, PostImagesService],
})
export class CommunityModule {}
