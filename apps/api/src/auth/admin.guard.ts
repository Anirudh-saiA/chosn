import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../db/db.provider';
import { AuthenticatedRequest } from './api-auth.guard';

/**
 * Always pair with `@UseGuards(ApiAuthGuard, AdminGuard)`, in that
 * order — this guard reads `request.user`, which only `ApiAuthGuard`
 * sets. NestJS runs guards in array order and short-circuits on the
 * first rejection, so an unauthenticated caller never reaches this
 * one's DB query at all.
 *
 * Checks role by hitting Postgres on every request rather than trusting
 * a `role` claim baked into the apiToken JWT at sign-in. That JWT is
 * only re-minted every 15 minutes (`lib/auth/api-token.ts`) and the
 * session token itself can live up to 24h between refreshes (Day 16's
 * `updateAge`) — a claim that stale is fine for "show the Admin nav
 * link" (apps/web's own UI-only check, in `auth.ts`'s session
 * callback), wrong for "let this request delete/modify a report."
 * Revoking someone's admin access should take effect on their very
 * next API call, not up to a day later. The extra query is one indexed
 * primary-key lookup — negligible against moderation-admin traffic
 * volumes, not something worth trading correctness for here.
 *
 * Flagged as an assumption in docs/trust-and-safety/README.md: a
 * single `role: 'admin'` column, not a separate permissions/roles
 * table. Overridable if CHOSN ever needs more than one non-user tier.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    // ApiAuthGuard runs first and would already have rejected an
    // unauthenticated caller — this is defense against the guard order
    // ever being swapped by mistake, not the primary check.
    if (!request.user?.userId) {
      throw new ForbiddenException({ error: 'forbidden', message: 'Admin access required.' });
    }

    const result = await this.pool.query<{ role: string }>('SELECT role FROM users WHERE id = $1', [
      request.user.userId,
    ]);
    const role = result.rows[0]?.role;

    if (role !== 'admin') {
      throw new ForbiddenException({ error: 'forbidden', message: 'Admin access required.' });
    }

    return true;
  }
}
