import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { ApiAuthGuard } from '../auth/api-auth.guard';
import { CommunityHealthService } from './community-health.service';

/**
 * Day 24 task 5 — the "not flying blind" dashboard, admin-only.
 * Deliberately not sophisticated (the brief's own words): a handful of
 * counts and one early-warning list, not a metrics platform. Extends
 * the Day 17 /admin area (this module already hosts the moderation-
 * queue-adjacent classifier check endpoint) rather than a new module.
 */
@Controller('admin/community-health')
@UseGuards(ApiAuthGuard, AdminGuard)
export class CommunityHealthController {
  constructor(private readonly health: CommunityHealthService) {}

  @Get()
  async summary() {
    return this.health.summary();
  }
}
