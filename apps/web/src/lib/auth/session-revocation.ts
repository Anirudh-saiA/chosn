/**
 * The revocation mechanism the JWT session strategy doesn't give you
 * for free. Real constraint hit while building this (see auth.ts's own
 * comment): Auth.js's Credentials provider *requires* `session.strategy:
 * 'jwt'` — "database" strategy throws `UnsupportedStrategy` outright,
 * confirmed by actually running the login flow and reading the real
 * error, not assumed from the docs. A JWT session has no server-side
 * row to delete for "sign out everywhere" or "invalidate every session
 * after a password change" — the standard fix is a small denylist: a
 * `revokedBefore` timestamp per user, checked in the `jwt` callback on
 * every request.
 *
 * Day 23 real production bug: this used to hold its own direct
 * `ioredis` client against `REDIS_URL`, same as the auth rate-limiter
 * did before Day 22's fix (see rate-limit.ts's own comment) — and
 * Vercel can't reach Railway's Redis directly for the same free-plan
 * single-TCP-proxy reason. Worse than the rate limiter's version of
 * this bug: `isRevoked` runs on *every* authenticated request (the
 * `jwt` callback calls it whenever a token has an `iat`, i.e. every
 * request after the first), so this hung `/api/auth/session` and every
 * page that calls `auth()` for an already-signed-in visitor —
 * `/account/security`, `/community`, the nav's own `useSession()` call
 * — for as long as ioredis kept retrying before the fail-open catch
 * ever fired. Same fix as the rate limiter: apps/api already has a
 * working *internal* Redis connection, so both functions here now call
 * `/internal/session-revocation/*` over HTTP instead of holding a
 * second Redis client. Same signatures, so auth.ts and the two route
 * handlers that call `revokeAllSessions` needed zero changes.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function internalHeaders(): Record<string, string> {
  const secret = process.env.API_JWT_SECRET;
  if (!secret) throw new Error('API_JWT_SECRET is not set — see .env.example');
  return { 'Content-Type': 'application/json', 'X-Internal-Secret': secret };
}

export async function revokeAllSessions(userId: string): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/internal/session-revocation/revoke`, {
      method: 'POST',
      headers: internalHeaders(),
      body: JSON.stringify({ userId }),
      // Same fast-fail posture as the rate limiter's call — this hop is
      // expected to resolve in milliseconds when apps/api is healthy.
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) throw new Error(`revoke returned ${res.status}`);
  } catch (err) {
    // Best-effort, not fatal: the caller's real action (password reset,
    // account deletion) already committed in Postgres by the time this
    // runs — losing the revocation just means an old token stays valid
    // until it naturally expires (session.maxAge, 7 days), not that the
    // whole request should fail.
    console.error('[sessionRevocation] revoke failed:', (err as Error).message);
  }
}

export async function isRevoked(userId: string, issuedAtSeconds: number): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/internal/session-revocation/check`, {
      method: 'POST',
      headers: internalHeaders(),
      body: JSON.stringify({ userId, issuedAtSeconds }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) throw new Error(`check returned ${res.status}`);
    const body = (await res.json()) as { revoked: boolean };
    return body.revoked;
  } catch (err) {
    // Fails open here, deliberately unlike the rate limiter: a Redis or
    // network outage should not lock every signed-in user out of the
    // entire app. Revocation is defense-in-depth (password-change
    // hygiene), not the only thing standing between an attacker and an
    // account the way login rate limiting is.
    console.error('[sessionRevocation] check failed, failing open:', (err as Error).message);
    return false;
  }
}
