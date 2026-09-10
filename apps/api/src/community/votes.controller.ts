import { Body, Controller, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest, ApiAuthGuard } from '../auth/api-auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { CastPollVoteDto } from './dto/cast-poll-vote.dto';
import { CastVoteDto } from './dto/cast-vote.dto';
import { VotesService } from './votes.service';

@Controller('community')
export class VotesController {
  constructor(private readonly votes: VotesService) {}

  /** Generic upvote/downvote — posts and comments both go through this one route (task 4's shared card-shell controls). */
  @Post('vote')
  @UseGuards(ApiAuthGuard, RateLimitGuard)
  @RateLimit({ limit: 120, windowSeconds: 3600 })
  async vote(@Req() req: AuthenticatedRequest, @Body() dto: CastVoteDto) {
    return this.votes.cast(req.user.userId, dto);
  }

  /** Cop or Drop's binary poll pick — distinct route, distinct table (see VotesService.castPoll). */
  @Post('posts/:id/poll-vote')
  @UseGuards(ApiAuthGuard, RateLimitGuard)
  @RateLimit({ limit: 60, windowSeconds: 3600 })
  async pollVote(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) postId: string,
    @Body() dto: CastPollVoteDto,
  ) {
    return this.votes.castPoll(postId, req.user.userId, dto);
  }
}
