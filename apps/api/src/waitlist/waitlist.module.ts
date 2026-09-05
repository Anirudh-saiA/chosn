import { Module } from '@nestjs/common';
import { RateLimitGuard } from '../common/rate-limit.guard';
import { redisProvider } from '../common/redis.provider';
import { pgPoolProvider } from '../db/db.provider';
import { EmailService } from '../email/email.service';
import { WaitlistController } from './waitlist.controller';
import { WaitlistService } from './waitlist.service';

@Module({
  controllers: [WaitlistController],
  providers: [pgPoolProvider, redisProvider, RateLimitGuard, EmailService, WaitlistService],
})
export class WaitlistModule {}
