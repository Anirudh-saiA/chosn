import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.provider';

export interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
  /**
   * A second budget keyed on a body field (e.g. an e-mail address), so one victim cannot be mailed
   * by many addresses even when each address stays under the per-IP limit. The value is hashed
   * before it goes into Redis, so no personal data is stored in a key.
   */
  also?: { bodyField: string; limit: number };
}

export const RATE_LIMIT_KEY = 'rate_limit';
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);

/**
 * Bump a fixed-window counter and say whether the caller is over `limit`. A key that somehow lost
 * its expiry (a crash between INCR and EXPIRE) is repaired on the next hit instead of blocking forever.
 */
export async function overLimit(redis: Redis, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const count = await redis.incr(key);
  if (count === 1 || (await redis.ttl(key)) === -1) await redis.expire(key, windowSeconds);
  return count > limit;
}

const hashed = (v: string) => createHash('sha256').update(v).digest('hex').slice(0, 32);

/**
 * Per-IP fixed-window limit, backed by Redis so it holds across
 * restarts and (eventually) multiple instances. A public,
 * unauthenticated POST endpoint is an abuse target from day one, not
 * once traffic shows up.
 *
 * Fails open on a Redis error — a rate limiter's job is to be a
 * secondary defense, not a single point of failure that takes down
 * signups if the cache hiccups.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<RateLimitOptions>(RATE_LIMIT_KEY, context.getHandler());
    if (!options) return true;

    const req = context.switchToHttp().getRequest<Request>();
    // req.ip, never the X-Forwarded-For header itself: main.ts sets `trust proxy`, so Express has already picked the
    // address the proxy saw. Reading the header's first entry would let any caller choose their own "IP" and skip the limit.
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const route = `${context.getClass().name}.${context.getHandler().name}`;

    try {
      if (await overLimit(this.redis, `ratelimit:${route}:${ip}`, options.limit, options.windowSeconds)) throw tooMany();
      if (options.also) {
        const raw = (req.body as Record<string, unknown> | undefined)?.[options.also.bodyField];
        if (typeof raw === 'string' && raw.trim() !== '') {
          const key = `ratelimit:${route}:${options.also.bodyField}:${hashed(raw.trim().toLowerCase())}`;
          if (await overLimit(this.redis, key, options.also.limit, options.windowSeconds)) throw tooMany();
        }
      }
    } catch (err) {
      if (err instanceof HttpException) throw err;
      // Redis unreachable — let the request through rather than block
      // real users because the rate limiter itself is down.
      return true;
    }

    return true;
  }
}

function tooMany(): HttpException {
  return new HttpException(
    { error: 'rate_limited', message: 'Too many attempts — try again in a bit.' },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}
