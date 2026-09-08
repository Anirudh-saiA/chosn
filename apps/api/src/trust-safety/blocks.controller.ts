import { Controller, Delete, Get, Param, ParseUUIDPipe, Post, Body, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest, ApiAuthGuard } from '../auth/api-auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { BlocksService } from './blocks.service';
import { CreateBlockDto } from './dto/create-block.dto';

@Controller('trust-safety/blocks')
@UseGuards(ApiAuthGuard)
export class BlocksController {
  constructor(private readonly blocks: BlocksService) {}

  @Post()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 50, windowSeconds: 3600 })
  async block(@Req() req: AuthenticatedRequest, @Body() dto: CreateBlockDto) {
    const block = await this.blocks.block(req.user.userId, dto.blockedUserId);
    return { block };
  }

  @Delete(':blockedUserId')
  async unblock(@Req() req: AuthenticatedRequest, @Param('blockedUserId', new ParseUUIDPipe()) blockedUserId: string) {
    await this.blocks.unblock(req.user.userId, blockedUserId);
    return { ok: true };
  }

  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    return { blocks: await this.blocks.list(req.user.userId) };
  }
}
