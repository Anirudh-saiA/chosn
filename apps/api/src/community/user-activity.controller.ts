import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { PostsService } from './posts.service';

/**
 * Day 24 task 3's profile activity feed — one round trip for both
 * halves (posts + comments) rather than the profile page making two
 * separate requests. Public read, same posture as the reputation
 * endpoint and the feed itself: a profile page is browsable by anyone,
 * signed in or not.
 */
@Controller('community/activity')
export class UserActivityController {
  constructor(
    private readonly posts: PostsService,
    private readonly comments: CommentsService,
  ) {}

  @Get(':userId')
  async get(@Param('userId', new ParseUUIDPipe()) userId: string) {
    const [{ posts: postList }, comments] = await Promise.all([
      this.posts.list({ authorUserId: userId, limit: 20 }, null),
      this.comments.listByAuthor(userId),
    ]);
    return { posts: postList, comments };
  }
}
