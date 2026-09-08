import Redis from 'ioredis';

/**
 * Redis-backed **sliding window** limiter (task 4) — deliberately a
 * different algorithm from apps/api's existing `RateLimitGuard`
 * (Day 5), which is a fixed window (`INCR` + `EXPIRE`). A fixed window
 * lets a burst of `limit` requests land right at the boundary between
 * two windows, doubling the effective rate for a moment — fine for the
 * general API traffic that guard protects, not fine for login/signup/
 * password-reset, which is exactly what credential stuffing exploits.
 * A sliding window (a Redis sorted set per key, scored by request
 * timestamp, trimmed to the trailing `windowSeconds` on every check)
 * has no such boundary — the count is always "requests in the last N
 * seconds," continuously, not "requests since the window last reset."
 *
 * Fails **closed** here, the opposite of apps/api's guard (which fails
 * open on a Redis error). That's deliberate too: a general-purpose API
 * guard failing open protects availability; an auth guard failing open
 * on the one thing standing between the internet and a credential-
 * stuffing bot is the wrong tradeoff — better to briefly 503 login
 * during a Redis outage than to silently remove its rate limit.
 */
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6380');
redis.on('error', (err) => console.error('[authRateLimit] redis error:', err.message));

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export async function slidingWindowRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;
  const redisKey = `authratelimit:${key}`;

  try {
    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(redisKey, 0, windowStart);
    pipeline.zcard(redisKey);
    const results = await pipeline.exec();
    const count = (results?.[1]?.[1] as number) ?? 0;

    if (count >= limit) {
      const oldest = await redis.zrange(redisKey, 0, 0, 'WITHSCORES');
      const oldestTimestamp = oldest[1] ? Number(oldest[1]) : now;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldestTimestamp + windowSeconds * 1000 - now) / 1000));
      return { allowed: false, retryAfterSeconds };
    }

    // member must be unique per request or ZADD silently coalesces two
    // requests landing in the same millisecond into one entry — a
    // random suffix on the score's own timestamp value is enough.
    await redis.zadd(redisKey, now, `${now}-${Math.random().toString(36).slice(2)}`);
    await redis.expire(redisKey, windowSeconds);
    return { allowed: true };
  } catch (err) {
    console.error('[authRateLimit] check failed, failing closed:', (err as Error).message);
    return { allowed: false, retryAfterSeconds: 30 };
  }
}

/** IP first (`x-forwarded-for`, Railway/Vercel-style proxying), falling back to a fixed key rather than throwing — better to rate-limit "everyone with no IP header" together than to 500 the request. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}
