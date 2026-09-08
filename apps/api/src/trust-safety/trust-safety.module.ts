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
  exports: [BlocksService],
})
export class TrustSafetyModule {}
