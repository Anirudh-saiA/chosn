import { Module } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { RateLimitGuard } from '../common/rate-limit.guard';
import { redisProvider } from '../common/redis.provider';
import { pgPoolProvider } from '../db/db.provider';
import { FeedbackController } from './feedback.controller';

@Module({
  controllers: [FeedbackController],
  providers: [pgPoolProvider, redisProvider, RateLimitGuard, AdminGuard],
})
export class FeedbackModule {}
