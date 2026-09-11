import { Module } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { RateLimitGuard } from '../common/rate-limit.guard';
import { redisProvider } from '../common/redis.provider';
import { pgPoolProvider } from '../db/db.provider';
import { BlocksController } from './blocks.controller';
import { BlocksService } from './blocks.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  controllers: [ReportsController, BlocksController],
  providers: [pgPoolProvider, redisProvider, RateLimitGuard, AdminGuard, ReportsService, BlocksService],
  // Day 24: ReportsService exported alongside BlocksService —
  // VotesService's vote-manipulation guard files a system report
  // through the exact same queue a human report goes through (task 6),
  // rather than inventing a parallel "flags" concept.
  exports: [BlocksService, ReportsService],
})
export class TrustSafetyModule {}
