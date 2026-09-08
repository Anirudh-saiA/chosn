import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../db/db.provider';

export interface UserBlock {
  id: string;
  blockerUserId: string;
  blockedUserId: string;
  createdAt: string;
}

/**
 * Task 2's enforcement contract, implemented once here rather than
 * documented and left for each future feature to reinvent:
 * `isBlockedEitherWay` is what a future DM inbox, post feed, or
 * @mention resolver calls before showing one user another user's
 * content — see docs/trust-and-safety/README.md for the full contract
 * this is the code half of.
 */
@Injectable()
export class BlocksService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async block(blockerUserId: string, blockedUserId: string): Promise<UserBlock> {
    if (blockerUserId === blockedUserId) {
      throw new BadRequestException({ error: 'invalid_block', message: "You can't block yourself." });
    }

    const result = await this.pool.query<UserBlock>(
      `INSERT INTO user_blocks (blocker_user_id, blocked_user_id)
       VALUES ($1, $2)
       -- Re-blocking is a no-op, not an error — the caller shouldn't
       -- need to check "am I already blocking them" before calling this.
       ON CONFLICT (blocker_user_id, blocked_user_id) DO UPDATE SET blocker_user_id = EXCLUDED.blocker_user_id
       RETURNING id, blocker_user_id AS "blockerUserId", blocked_user_id AS "blockedUserId", created_at AS "createdAt"`,
      [blockerUserId, blockedUserId],
    );
    return result.rows[0]!; // INSERT ... ON CONFLICT DO UPDATE ... RETURNING always returns one row
  }

  async unblock(blockerUserId: string, blockedUserId: string): Promise<void> {
    await this.pool.query('DELETE FROM user_blocks WHERE blocker_user_id = $1 AND blocked_user_id = $2', [
      blockerUserId,
      blockedUserId,
    ]);
  }

  async list(blockerUserId: string): Promise<UserBlock[]> {
    const result = await this.pool.query<UserBlock>(
      `SELECT id, blocker_user_id AS "blockerUserId", blocked_user_id AS "blockedUserId", created_at AS "createdAt"
       FROM user_blocks WHERE blocker_user_id = $1 ORDER BY created_at DESC`,
      [blockerUserId],
    );
    return result.rows;
  }

  /**
   * The one enforcement primitive: true if either user has blocked the
   * other. Checked both directions deliberately — a block is meant to
   * stop unwanted contact regardless of who initiated it, so "the
   * person I blocked DMs me anyway" and "someone who blocked me DMs me
   * anyway" both need to fail the same check. Every future
   * content-visibility/DM-send code path should call this rather than
   * querying `user_blocks` directly.
   */
  async isBlockedEitherWay(userA: string, userB: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM user_blocks
       WHERE (blocker_user_id = $1 AND blocked_user_id = $2)
          OR (blocker_user_id = $2 AND blocked_user_id = $1)
       LIMIT 1`,
      [userA, userB],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
