/**
 * Real bug found in production (Day 22), then a real infra constraint
 * found fixing it: this used to hold its own Redis client directly,
 * which needs `REDIS_URL` reachable from Vercel — but Railway's free
 * plan allows only one public TCP proxy, and Postgres already needs
 * its one (the NextAuth adapter has no way around direct DB access —
 * see lib/auth/db.ts's own comment). Redis has no such hard
 * requirement: apps/api already has a working *internal* Redis
 * connection on Railway, so the sliding-window check itself now lives
 * there (`POST /internal/auth-rate-limit/check`, see that controller's
 * own doc comment) — this file just calls it over HTTP instead of
 * holding a second Redis client. Same algorithm, same fail-closed
 * behavior on any error, same public function signature, so every
 * call site (auth.ts, sign-up, password-reset, delete-account,
 * totp/enable) needed zero changes.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export async function slidingWindowRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  try {
    const secret = process.env.API_JWT_SECRET;
    if (!secret) throw new Error('API_JWT_SECRET is not set — see .env.example');

    const res = await fetch(`${API_URL}/internal/auth-rate-limit/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': secret },
      body: JSON.stringify({ key, limit, windowSeconds }),
      // A few seconds, not the platform default (which can run well
      // past what a login/signup request should ever wait) — this
      // service-to-service hop is expected to resolve in milliseconds
      // when apps/api is healthy; anything slower should fail fast and
      // closed, the same posture apps/api's own Redis client already
      // takes with maxRetriesPerRequest: 1.
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok) throw new Error(`rate limit check returned ${res.status}`);
    return (await res.json()) as RateLimitResult;
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
