import { Body, ConflictException, Controller, Post, UseGuards } from '@nestjs/common';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';
import { WaitlistService } from './waitlist.service';

@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlist: WaitlistService) {}

  @Post()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 5, windowSeconds: 3600 }) // signups are one-shot; 5/hr covers retries, not bots
  async join(@Body() dto: JoinWaitlistDto) {
    const result = await this.waitlist.join(dto.email, dto.interests);

    if (result.status === 'duplicate') {
      throw new ConflictException({
        error: 'duplicate',
        message: "You're already on the list — we'll email you when access opens.",
      });
    }

    return { ok: true };
  }
}
