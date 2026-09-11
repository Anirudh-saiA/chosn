import { Module } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { pgPoolProvider } from '../db/db.provider';
import { PricingModule } from '../pricing/pricing.module';
import { CommunityHealthController } from './community-health.controller';
import { CommunityHealthService } from './community-health.service';
import { ModerationController } from './moderation.controller';

/** Imports PricingModule for DRIZZLE (Day 24's CommunityHealthService) — AdminGuard still needs its own PG_POOL, same as before. */
@Module({
  imports: [PricingModule],
  controllers: [ModerationController, CommunityHealthController],
  // AdminGuard needs PG_POOL; ApiAuthGuard needs nothing injected.
  providers: [pgPoolProvider, AdminGuard, CommunityHealthService],
})
export class ModerationModule {}
