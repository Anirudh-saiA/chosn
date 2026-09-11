import { Body, Controller, Get, HttpCode, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest, ApiAuthGuard } from '../auth/api-auth.guard';
import { SetNotificationPreferenceDto } from './dto/set-notification-preference.dto';
import { CommunityNotificationsService } from './community-notifications.service';

/**
 * Task 2/3 — a signed-in user's own reply/mention inbox and their
 * community-notification opt-in/out, both scoped to `req.user.userId`
 * only (no way to read or change anyone else's). The profile page
 * (task 3) renders this on a viewer's own profile; nothing here is
 * public read the way reputation is.
 */
@Controller('community/notifications')
@UseGuards(ApiAuthGuard)
export class CommunityNotificationsController {
  constructor(private readonly notifications: CommunityNotificationsService) {}

  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    return { notifications: await this.notifications.listForUser(req.user.userId) };
  }

  @Get('unread-count')
  async unreadCount(@Req() req: AuthenticatedRequest) {
    return { count: await this.notifications.unreadCount(req.user.userId) };
  }

  @Post('mark-read')
  @HttpCode(200)
  async markRead(@Req() req: AuthenticatedRequest) {
    await this.notifications.markAllRead(req.user.userId);
    return { ok: true };
  }

  @Get('preference')
  async getPreference(@Req() req: AuthenticatedRequest) {
    return { enabled: await this.notifications.getPreference(req.user.userId) };
  }

  @Patch('preference')
  async setPreference(@Req() req: AuthenticatedRequest, @Body() dto: SetNotificationPreferenceDto) {
    await this.notifications.setPreference(req.user.userId, dto.enabled);
    return { ok: true };
  }
}
