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
import type { Request } from 'express';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.provider';

export interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
}

const RATE_LIMIT_KEY = 'rate_limit';
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);

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
    // req.ip, not the X-Forwarded-For header: main.ts sets `trust proxy` to 1, so Express already takes the address the platform's proxy saw.
    // The header's first value is whatever the caller typed, so keying on it let anyone dodge every limit by changing it (SEC-14).
    const ip = req.ip || 'unknown';
    // Class name too: handlers called `create` in several controllers used to share one counter.
    const key = `ratelimit:${context.getClass().name}.${context.getHandler().name}:${ip}`;

    try {
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.expire(key, options.windowSeconds);
      }
      if (count > options.limit) {
        throw new HttpException(
          { error: 'rate_limited', message: 'Too many attempts — try again in a bit.' },
          HttpStatus.TOO_MANY_REQUESTS,
        );
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
