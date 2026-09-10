import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../common/redis.provider';
import { CheckRateLimitDto } from './dto/check-rate-limit.dto';
import { InternalSecretGuard } from './internal-secret.guard';

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

/**
 * Day 22 fix: apps/web's auth rate-limiter (login/signup/password-reset/
 * delete-account/totp) needs Redis, but Railway's free plan allows only
 * one public TCP proxy — already spent on Postgres, which the NextAuth
 * adapter genuinely can't avoid needing direct access to (see
 * apps/web/src/lib/auth/db.ts's own comment). Redis has no such
 * hard requirement: apps/api already has a working *internal* Redis
 * connection on Railway (no public proxy needed, no cost), so this
 * endpoint moves the sliding-window check here instead of asking
 * apps/web to reach Redis directly. `apps/web/src/lib/auth/rate-limit.ts`
 * now calls this over HTTP instead of holding its own Redis client —
 * same algorithm, same fail-closed behavior, just relocated to the
 * side of the network that can actually reach Redis for free.
 *
 * `InternalSecretGuard` gates this — it's not meant to be a public
 * rate-limiting-as-a-service endpoint, just apps/web's own check
 * relocated.
 */
@Controller('internal/auth-rate-limit')
@UseGuards(InternalSecretGuard)
export class AuthRateLimitController {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  @Post('check')
  async check(@Body() dto: CheckRateLimitDto): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - dto.windowSeconds * 1000;
    const redisKey = `authratelimit:${dto.key}`;

    try {
      const pipeline = this.redis.pipeline();
      pipeline.zremrangebyscore(redisKey, 0, windowStart);
      pipeline.zcard(redisKey);
      const results = await pipeline.exec();
      const count = (results?.[1]?.[1] as number) ?? 0;

      if (count >= dto.limit) {
        const oldest = await this.redis.zrange(redisKey, '0', '0', 'WITHSCORES');
        const oldestTimestamp = oldest[1] ? Number(oldest[1]) : now;
        const retryAfterSeconds = Math.max(1, Math.ceil((oldestTimestamp + dto.windowSeconds * 1000 - now) / 1000));
        return { allowed: false, retryAfterSeconds };
      }

      await this.redis.zadd(redisKey, now, `${now}-${Math.random().toString(36).slice(2)}`);
      await this.redis.expire(redisKey, dto.windowSeconds);
      return { allowed: true };
    } catch {
      // Same fail-closed posture as the original apps/web implementation
      // — an auth rate-limiter erring open on a Redis blip is the wrong
      // tradeoff (see rate-limit.ts's own header comment). REDIS_CLIENT
      // here already has maxRetriesPerRequest: 1, so this resolves fast
      // either way, never the ~2-minute hang the original bug had.
      return { allowed: false, retryAfterSeconds: 30 };
    }
  }
}
