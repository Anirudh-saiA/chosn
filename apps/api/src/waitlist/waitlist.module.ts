import { Module } from '@nestjs/common';
import { RateLimitGuard } from '../common/rate-limit.guard';
import { redisProvider } from '../common/redis.provider';
import { pgPoolProvider } from '../db/db.provider';
import { EmailService } from '../email/email.service';
import { WaitlistController } from './waitlist.controller';
import { WaitlistDripService } from './waitlist-drip.service';
import { WaitlistService } from './waitlist.service';
import { WaitlistSheetService } from './waitlist-sheet.service';

@Module({
  controllers: [WaitlistController],
  providers: [pgPoolProvider, redisProvider, RateLimitGuard, EmailService, WaitlistDripService, WaitlistSheetService, WaitlistService],
})
export class WaitlistModule {}
