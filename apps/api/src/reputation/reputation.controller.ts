import { Controller, Get, Inject, NotFoundException, Param, ParseUUIDPipe } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { users } from '../db/schema';
import { ReputationService } from './reputation.service';

/**
 * Public read, no auth — reputation is a badge shown next to a username
 * anywhere it appears (posts, comments, chat, a profile), same
 * "public unless it's an account holder's own control" posture the
 * community feed itself takes (see PostsController's own comment).
 * Also returns the minimal public identity (displayName/avatarSeed) —
 * the profile page (task 1: "display reputation on user profiles")
 * needs exactly this and nothing else, so one call here covers it
 * rather than a second round trip to an endpoint that doesn't exist.
 */
@Controller('reputation')
export class ReputationController {
  constructor(
    private readonly reputation: ReputationService,
    @Inject(DRIZZLE) private readonly db: Db,
  ) {}

  @Get(':userId')
  async get(@Param('userId', new ParseUUIDPipe()) userId: string) {
    const [user] = await this.db
      .select({ displayName: users.displayName, avatarSeed: users.avatarSeed })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) throw new NotFoundException({ error: 'not_found', message: 'No user with that id.' });

    const summary = await this.reputation.getForUser(userId);
    return { reputation: summary, user };
  }
}
