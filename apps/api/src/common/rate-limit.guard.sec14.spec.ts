import { HttpException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { RateLimit, RateLimitGuard } from './rate-limit.guard';

/** SEC-14: the limit keys on the real client address, not a header the caller controls, and not on a handler name shared with other controllers. */
class PostsController {
  @RateLimit({ limit: 2, windowSeconds: 60 })
  create() {}
}
class CommentsController {
  @RateLimit({ limit: 2, windowSeconds: 60 })
  create() {}
}

function setup() {
  const counts = new Map<string, number>();
  const redis = { incr: async (k: string) => counts.set(k, (counts.get(k) ?? 0) + 1).get(k)!, ttl: async () => 60, expire: async () => 1 };
  const guard = new RateLimitGuard(redis as never, new Reflector());
  const ctx = (cls: new () => object, ip: string, headers: Record<string, string> = {}) =>
    ({
      getHandler: () => cls.prototype.create,
      getClass: () => cls,
      switchToHttp: () => ({ getRequest: () => ({ ip, headers }) }),
    }) as unknown as ExecutionContext;
  return { guard, ctx, counts };
}

describe('RateLimitGuard (SEC-14)', () => {
  it('blocks the third call from one address even when X-Forwarded-For changes every time', async () => {
    const { guard, ctx } = setup();
    await guard.canActivate(ctx(PostsController, '203.0.113.7', { 'x-forwarded-for': '1.1.1.1' }));
    await guard.canActivate(ctx(PostsController, '203.0.113.7', { 'x-forwarded-for': '2.2.2.2' }));
    await expect(guard.canActivate(ctx(PostsController, '203.0.113.7', { 'x-forwarded-for': '3.3.3.3' }))).rejects.toBeInstanceOf(HttpException);
  });

  it('keeps counters separate for same-named handlers in different controllers', async () => {
    const { guard, ctx } = setup();
    await guard.canActivate(ctx(PostsController, '203.0.113.7'));
    await guard.canActivate(ctx(PostsController, '203.0.113.7'));
    await expect(guard.canActivate(ctx(CommentsController, '203.0.113.7'))).resolves.toBe(true);
  });
});
