import jwt from 'jsonwebtoken';

/**
 * Verifies the short-lived Bearer token apps/web mints in its NextAuth
 * `session()` callback (`lib/auth/api-token.ts`, signed with the same
 * `API_JWT_SECRET` — set identically on both services, or verification
 * always fails). A plain HS256 JWT check via the standard
 * `jsonwebtoken` library — the same "vetted library, not hand-rolled
 * crypto" standard Day 16's password hashing follows.
 *
 * The one thing this API verifies about a caller today. Nothing in
 * this app requires it yet (every existing endpoint stays open — see
 * DropLiveGateway's own comment on why this exists ahead of an actual
 * requirement), but it's the one place that logic lives, so every
 * future authenticated endpoint or gateway calls this instead of
 * re-implementing JWT verification per call site.
 */
export interface ApiJwtPayload {
  userId: string;
  email: string;
}

export function verifyApiToken(token: string): ApiJwtPayload | null {
  const secret = process.env.API_JWT_SECRET;
  if (!secret) return null;

  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (typeof decoded === 'string' || !decoded.sub || typeof decoded.email !== 'string') return null;
    return { userId: decoded.sub, email: decoded.email };
  } catch {
    // Expired, malformed, wrong secret — all the same outcome here:
    // treat the caller as unauthenticated, never throw. Every current
    // call site (DropLiveGateway) falls back to anonymous rather than
    // rejecting the connection.
    return null;
  }
}
