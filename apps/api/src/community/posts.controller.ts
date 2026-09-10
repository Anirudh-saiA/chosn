import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest, ApiAuthGuard } from '../auth/api-auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { OptionalAuth } from '../auth/optional-auth.decorator';
import type { OptionallyAuthenticatedRequest } from '../auth/optional-auth.guard';
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';
import { PostsService } from './posts.service';

@Controller('community/posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @UseGuards(ApiAuthGuard, RateLimitGuard)
  @RateLimit({ limit: 20, windowSeconds: 3600 })
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreatePostDto) {
    const post = await this.postsService.create(req.user.userId, dto);
    return { post };
  }

  /**
   * Public read — the feed itself doesn't require sign-in (task 4), only
   * posting/voting/commenting does. `OptionalAuth` reads the caller's
   * identity when a valid token is present (for viewerVote/viewerChoice
   * and block-filtering) without rejecting an anonymous request.
   */
  @Get()
  @OptionalAuth()
  async list(@Req() req: OptionallyAuthenticatedRequest, @Query() query: ListPostsQueryDto) {
    return this.postsService.list(query, req.user?.userId ?? null);
  }

  @Get(':id')
  @OptionalAuth()
  async get(@Req() req: OptionallyAuthenticatedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    const post = await this.postsService.get(id, req.user?.userId ?? null);
    return { post };
  }
}
