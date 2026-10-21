import 'reflect-metadata';
import { HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { WatchController } from '../catalog/watch.controller';
import { EventsController } from '../catalog/events.controller';
import { OrderFeedbackController } from '../catalog/order-feedback.controller';
import { DropWatchController } from '../drops/drop-watch.controller';
import { WaitlistController } from '../waitlist/waitlist.controller';
import { RATE_LIMIT_KEY, RateLimit, RateLimitGuard, type RateLimitOptions } from './rate-limit.guard';

/** Just enough of ioredis for a fixed-window counter. `ttlLost` simulates a key that lost its expiry. */
class FakeRedis {
  counts = new Map<string, number>();
  expiries = new Map<string, number>();
  down = false;
  async incr(k: string) {
    if (this.down) throw new Error('redis down');
    const n = (this.counts.get(k) ?? 0) + 1;
    this.counts.set(k, n);
    return n;
  }
  async ttl(k: string) {
    return this.expiries.has(k) ? this.expiries.get(k)! : -1;
  }
  async expire(k: string, s: number) {
    this.expiries.set(k, s);
    return 1;
  }
}

class Demo {
  @RateLimit({ limit: 2, windowSeconds: 60, also: { bodyField: 'email', limit: 1 } })
  mail() {}
  @RateLimit({ limit: 2, windowSeconds: 60 })
  plain() {}
  other() {}
}

function ctx(handler: (...a: never[]) => unknown, req: Record<string, unknown>) {
  return {
    getHandler: () => handler,
    getClass: () => Demo,
    switchToHttp: () => ({ getRequest: () => req }),
  } as never;
}

const make = (redis: FakeRedis) => new RateLimitGuard(redis as never, new Reflector());
const status = async (p: Promise<boolean>) => {
  try {
    await p;
    return 200;
  } catch (e) {
    return e instanceof HttpException ? e.getStatus() : 500;
  }
};

describe('RateLimitGuard', () => {
  it('lets a handler without a limit through', async () => {
    expect(await make(new FakeRedis()).canActivate(ctx(Demo.prototype.other, { ip: '1.1.1.1' }))).toBe(true);
  });

  it('allows up to the limit then answers 429', async () => {
    const g = make(new FakeRedis());
    const c = ctx(Demo.prototype.plain, { ip: '1.1.1.1', headers: {} });
    expect([await status(g.canActivate(c)), await status(g.canActivate(c)), await status(g.canActivate(c))]).toEqual([200, 200, 429]);
  });

  it('keeps one budget per address', async () => {
    const g = make(new FakeRedis());
    for (let i = 0; i < 3; i++) await status(g.canActivate(ctx(Demo.prototype.plain, { ip: '1.1.1.1' })));
    expect(await status(g.canActivate(ctx(Demo.prototype.plain, { ip: '2.2.2.2' })))).toBe(200);
  });

  it('ignores a spoofed X-Forwarded-For header and counts the real address', async () => {
    const g = make(new FakeRedis());
    const hit = (xff: string) => status(g.canActivate(ctx(Demo.prototype.plain, { ip: '9.9.9.9', headers: { 'x-forwarded-for': xff } })));
    expect([await hit('1.1.1.1'), await hit('2.2.2.2'), await hit('3.3.3.3')]).toEqual([200, 200, 429]);
  });

  it('limits one e-mail address across many IPs, case-insensitively, without storing the address', async () => {
    const redis = new FakeRedis();
    const g = make(redis);
    const from = (ip: string, email: string) => status(g.canActivate(ctx(Demo.prototype.mail, { ip, body: { email } })));
    expect(await from('1.1.1.1', 'Victim@Example.com')).toBe(200);
    expect(await from('2.2.2.2', 'victim@example.com ')).toBe(429);
    expect(await from('3.3.3.3', 'someone@else.com')).toBe(200);
    expect([...redis.counts.keys()].some((k) => k.toLowerCase().includes('victim'))).toBe(false);
  });

  it('repairs a counter that lost its expiry', async () => {
    const redis = new FakeRedis();
    redis.counts.set('ratelimit:Demo.plain:1.1.1.1', 5);
    await status(make(redis).canActivate(ctx(Demo.prototype.plain, { ip: '1.1.1.1' })));
    expect(redis.expiries.get('ratelimit:Demo.plain:1.1.1.1')).toBe(60);
  });

  it('fails open when Redis is down', async () => {
    const redis = new FakeRedis();
    redis.down = true;
    expect(await make(redis).canActivate(ctx(Demo.prototype.plain, { ip: '1.1.1.1' }))).toBe(true);
  });
});

/**
 * The public write / e-mail endpoints added or changed in task 3. If someone removes a limit, this fails.
 * (Endpoints limited earlier — feedback, notifications, community, trust-safety — are not repeated here.)
 */
describe('public write endpoints carry a rate limit', () => {
  const cases: Array<[string, { prototype: object }, string, number, number]> = [
    ['POST /watch', WatchController, 'create', 20, 3600],
    ['PUT /watch/:id/items', WatchController, 'items', 120, 3600],
    ['POST /watch/:id/email', WatchController, 'setEmail', 5, 3600],
    ['PATCH /watch/:id/prefs', WatchController, 'prefs', 60, 3600],
    ['POST /watch/:id/alerts/read', WatchController, 'read', 120, 3600],
    ['GET /watch/confirm', WatchController, 'confirm', 60, 3600],
    ['GET /watch/unsubscribe', WatchController, 'unsubscribe', 60, 3600],
    ['PUT /watch/:id/drops/follow', DropWatchController, 'follow', 120, 3600],
    ['PUT /watch/:id/drops/reminders', DropWatchController, 'reminders', 120, 3600],
    ['POST /events', EventsController, 'record', 120, 60],
    ['POST /order-feedback', OrderFeedbackController, 'submit', 12, 3600],
    ['POST /waitlist', WaitlistController, 'join', 5, 3600],
    ['POST /waitlist/unsubscribe', WaitlistController, 'unsubscribePost', 60, 3600],
  ];
  it.each(cases)('%s', (_name, controller, method, limit, windowSeconds) => {
    const handler = (controller.prototype as Record<string, unknown>)[method] as object;
    const opts = Reflect.getMetadata(RATE_LIMIT_KEY, handler) as RateLimitOptions | undefined;
    expect(opts).toMatchObject({ limit, windowSeconds });
    const guards = (Reflect.getMetadata('__guards__', handler) ?? []) as unknown[];
    expect(guards).toContain(RateLimitGuard);
  });

  it('the e-mail endpoints also limit per address', () => {
    for (const [c, m] of [[WatchController, 'setEmail'], [WaitlistController, 'join']] as Array<[{ prototype: object }, string]>) {
      const opts = Reflect.getMetadata(RATE_LIMIT_KEY, (c.prototype as Record<string, unknown>)[m] as object) as RateLimitOptions;
      expect(opts.also).toMatchObject({ bodyField: 'email', limit: 3 });
    }
  });
});
