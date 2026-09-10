import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { ReputationController } from './reputation.controller';
import { ReputationSchedulerService } from './reputation-scheduler.service';
import { ReputationService } from './reputation.service';

/**
 * Day 23's reputation v1 — see ReputationService's own doc comment for
 * the formula. Imports PricingModule for DRIZZLE, same "don't open a
 * second connection pool" reasoning every other module here follows;
 * exports ReputationService so CommunityModule (vote-triggered
 * recalculation, the Legit Check gate, badges on posts/comments) and
 * ChatModule (badges on chat messages) can both use it without either
 * depending on the other.
 */
@Module({
  imports: [PricingModule],
  controllers: [ReputationController],
  providers: [ReputationService, ReputationSchedulerService],
  exports: [ReputationService],
})
export class ReputationModule {}
