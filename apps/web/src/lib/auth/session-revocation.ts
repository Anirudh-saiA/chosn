import Redis from 'ioredis';

/**
 * The revocation mechanism the JWT session strategy doesn't give you
 * for free. Real constraint hit while building this (see auth.ts's own
 * comment): Auth.js's Credentials provider *requires* `session.strategy:
 * 'jwt'` — "database" strategy throws `UnsupportedStrategy` outright,
 * confirmed by actually running the login flow and reading the real
 * error, not assumed from the docs. A JWT session has no server-side
 * row to delete for "sign out everywhere" or "invalidate every session
 * after a password change" — the standard fix is a small denylist: a
 * `revokedBefore` timestamp per user in Redis, checked in the `jwt`
 * callback on every request. A token issued before that timestamp is
 * rejected regardless of its own `exp` — cheap (one Redis GET per
 * request, already on the connection pool this app's other Redis use
 * shares) and gives back the real revocation task 1 asked for.
 */
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6380');
redis.on('error', (err) => console.error('[sessionRevocation] redis error:', err.message));

function key(userId: string): string {
  return `session-revoked-before:${userId}`;
}

export async function revokeAllSessions(userId: string): Promise<void> {
  // Stored as seconds (matches JWT `iat`), kept for 30 days — the
  // longest a session can possibly live (session.maxAge) — no reason
  // to remember a revocation past the point every old token would have
  // expired on its own anyway.
  await redis.set(key(userId), Math.floor(Date.now() / 1000), 'EX', 30 * 24 * 60 * 60);
}

export async function isRevoked(userId: string, issuedAtSeconds: number): Promise<boolean> {
  try {
    const revokedBefore = await redis.get(key(userId));
    return revokedBefore !== null && issuedAtSeconds < Number(revokedBefore);
  } catch (err) {
    // Fails open here, deliberately unlike the rate limiter: a Redis
    // outage should not lock every signed-in user out of the entire
    // app. Revocation is a defense-in-depth feature (password-change
    // hygiene), not the only thing standing between an attacker and an
    // account the way login rate limiting is.
    console.error('[sessionRevocation] check failed, failing open:', (err as Error).message);
    return false;
  }
}
