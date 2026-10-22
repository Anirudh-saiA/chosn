import { Body, ConflictException, Controller, Get, Header, Post, Query, UseGuards } from '@nestjs/common';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';
import { WaitlistService } from './waitlist.service';

const page = (msg: string) =>
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CHOSN</title>
<body style="font-family:Georgia,serif;background:#F6F5F1;color:#141414;display:grid;place-items:center;min-height:100vh;margin:0">
<p style="max-width:32ch;font-size:18px;line-height:1.5;text-align:center">${msg}</p></body>`;

@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlist: WaitlistService) {}

  @Post()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 5, windowSeconds: 3600 }) // signups are one-shot; 5/hr covers retries, not bots
  async join(@Body() dto: JoinWaitlistDto) {
    const result = await this.waitlist.join(dto.name, dto.email, dto.interests, dto.shoes, dto.phone);

    if (result.status === 'duplicate') {
      throw new ConflictException({
        error: 'duplicate',
        message: "You're already on the list — we'll email you when access opens.",
      });
    }

    return { ok: true };
  }

  @Get('unsubscribe')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async unsubscribe(@Query('token') token = '') {
    const ok = await this.waitlist.unsubscribe(token);
    return ok
      ? page("You're unsubscribed. No more emails from the CHOSN waitlist.")
      : page('That unsubscribe link is not valid.');
  }

  /** RFC 8058 one-click unsubscribe — mail clients POST here. */
  @Post('unsubscribe')
  async unsubscribePost(@Query('token') token = '') {
    await this.waitlist.unsubscribe(token);
    return { ok: true };
  }
}
