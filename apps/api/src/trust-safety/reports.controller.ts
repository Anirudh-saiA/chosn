import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { AuthenticatedRequest, ApiAuthGuard } from '../auth/api-auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { CreateReportDto } from './dto/create-report.dto';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';
import { ReviewReportDto } from './dto/review-report.dto';
import { ReportsService } from './reports.service';

@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /**
   * The generic `reportEntity` endpoint from task 1 — every future
   * reportable content type (post, comment, message) calls this same
   * route with its own `reportedEntityType`, never a type-specific one.
   */
  @Post('trust-safety/reports')
  @UseGuards(ApiAuthGuard, RateLimitGuard)
  @RateLimit({ limit: 20, windowSeconds: 3600 }) // a real user reports a handful of things, not dozens/hour — also blunts using the report queue itself as a harassment/spam vector against one target
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateReportDto) {
    const report = await this.reports.create(req.user.userId, dto);
    return { report };
  }

  @Get('trust-safety/reports')
  @UseGuards(ApiAuthGuard, AdminGuard)
  async list(@Query() query: ListReportsQueryDto) {
    return this.reports.list(query);
  }

  @Patch('trust-safety/reports/:id')
  @UseGuards(ApiAuthGuard, AdminGuard)
  async review(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReviewReportDto,
  ) {
    const report = await this.reports.review(id, req.user.userId, dto);
    return { report };
  }
}
