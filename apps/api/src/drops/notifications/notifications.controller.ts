import { Body, Controller, Delete, Get, Post, Query, UseGuards } from '@nestjs/common';
import { RateLimit, RateLimitGuard } from '../../common/rate-limit.guard';
import { IdentifyDto } from './dto/identify.dto';
import { PushSubscribeDto, PushUnsubscribeDto } from './dto/push-subscription.dto';
import { SubscriptionDto } from './dto/subscription.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /**
   * The VAPID public key the frontend needs to call
   * pushManager.subscribe() — served from config rather than hardcoded
   * client-side so it can be rotated without a frontend deploy.
   */
  @Get('vapid-public-key')
  vapidPublicKey(): { publicKey: string | null } {
    return { publicKey: process.env.VAPID_PUBLIC_KEY ?? null };
  }

  @Post('identify')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 20, windowSeconds: 3600 }) // one per visitor per session in practice; generous enough for retries
  async identify(@Body() dto: IdentifyDto) {
    return this.notifications.identify(dto.email);
  }

  @Post('subscriptions')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 30, windowSeconds: 3600 }) // task 7 — a real visitor toggles a handful of these, not dozens
  async subscribe(@Body() dto: SubscriptionDto) {
    await this.notifications.subscribe(dto.subscriberId, dto.scopeType, dto.scopeValue ?? null);
    return { ok: true };
  }

  @Delete('subscriptions')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 30, windowSeconds: 3600 })
  async unsubscribe(@Body() dto: SubscriptionDto) {
    await this.notifications.unsubscribe(dto.subscriberId, dto.scopeType, dto.scopeValue ?? null);
    return { ok: true };
  }

  @Get('subscriptions')
  async list(@Query('subscriberId') subscriberId: string) {
    if (!subscriberId) return { subscriptions: [] };
    return { subscriptions: await this.notifications.list(subscriberId) };
  }

  @Post('push-subscribe')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 30, windowSeconds: 3600 })
  async pushSubscribe(@Body() dto: PushSubscribeDto) {
    await this.notifications.pushSubscribe(dto.subscriberId, dto.endpoint, dto.keys.p256dh, dto.keys.auth);
    return { ok: true };
  }

  @Post('push-unsubscribe')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 30, windowSeconds: 3600 })
  async pushUnsubscribe(@Body() dto: PushUnsubscribeDto) {
    await this.notifications.pushUnsubscribe(dto.endpoint);
    return { ok: true };
  }
}
