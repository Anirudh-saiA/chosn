import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../common/redis.provider';
import { CheckRevocationDto, RevokeSessionsDto } from './dto/session-revocation.dto';
import { InternalSecretGuard } from './internal-secret.guard';

/**
 * Day 23 fix: the exact same bug the rate-limiter had (see
 * `auth-rate-limit.controller.ts`'s own comment) was still sitting in
 * `apps/web/src/lib/auth/session-revocation.ts` — a direct `ioredis`
 * client with no retry/connect limits, pointed at `REDIS_URL`, which
 * Vercel can't reach (Railway free-plan single TCP proxy, already spent
 * on Postgres). Unlike the rate limiter, this one runs on *every*
 * authenticated request (the `jwt` callback calls `isRevoked` whenever
 * a token has an `iat`), so it hung `/api/auth/session` and every
 * Server Component that calls `auth()` — `/account/security`,
 * `/community`, anything — for any already-signed-in visitor. That's
 * the real cause behind "can't reach Account/Community" and very
 * likely behind the login flow looking broken in the browser too: the
 * client-side `useSession()` call the nav depends on hits this exact
 * endpoint and would hang the same way.
 *
 * Same relocation as the rate limiter: apps/api already holds a working
 * internal Redis connection, so both `revokeAllSessions` and
 * `isRevoked` move here.
 */
@Controller('internal/session-revocation')
@UseGuards(InternalSecretGuard)
export class SessionRevocationController {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private key(userId: string): string {
    return `session-revoked-before:${userId}`;
  }

  @Post('revoke')
  async revoke(@Body() dto: RevokeSessionsDto): Promise<{ ok: true }> {
    // 30 days — the longest a session can possibly live (session.maxAge
    // in auth.ts) — no reason to remember a revocation past the point
    // every old token would have expired on its own anyway.
    await this.redis.set(this.key(dto.userId), Math.floor(Date.now() / 1000), 'EX', 30 * 24 * 60 * 60);
    return { ok: true };
  }

  @Post('check')
  async check(@Body() dto: CheckRevocationDto): Promise<{ revoked: boolean }> {
    const revokedBefore = await this.redis.get(this.key(dto.userId));
    const revoked = revokedBefore !== null && dto.issuedAtSeconds < Number(revokedBefore);
    return { revoked };
  }
}
