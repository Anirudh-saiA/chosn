import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest, ApiAuthGuard } from '../auth/api-auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Controller('community/posts/:postId/comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Post()
  @UseGuards(ApiAuthGuard, RateLimitGuard)
  @RateLimit({ limit: 60, windowSeconds: 3600 })
  async create(
    @Req() req: AuthenticatedRequest,
    @Param('postId', new ParseUUIDPipe()) postId: string,
    @Body() dto: CreateCommentDto,
  ) {
    const comment = await this.comments.create(postId, req.user.userId, dto);
    return { comment };
  }

  @Get()
  async list(@Param('postId', new ParseUUIDPipe()) postId: string) {
    return { comments: await this.comments.list(postId) };
  }
}
