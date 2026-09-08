import jwt from 'jsonwebtoken';

/**
 * The short-lived credential the browser actually holds and sends to
 * apps/api as `Authorization: Bearer <token>` — see auth.ts's session
 * callback for why this exists alongside (not instead of) the long-
 * lived httpOnly session cookie. Signed with API_JWT_SECRET, a value
 * shared between apps/web and apps/api and nowhere else — not the same
 * secret as AUTH_SECRET (NextAuth's own cookie-encryption key), so a
 * compromise of one doesn't compromise the other.
 *
 * A plain HS256 JWT via the standard `jsonwebtoken` library, not a
 * hand-rolled token format — verifying/signing a JWT with a known
 * secret through a vetted library is the ordinary way to do
 * service-to-service auth, which is a different job from "don't
 * hand-roll password hashing/session logic" (task 1): this token never
 * carries a password or drives NextAuth's own session state, it's
 * purely an API bearer credential.
 */
const TOKEN_TTL_SECONDS = 15 * 60;

function secret(): string {
  const key = process.env.API_JWT_SECRET;
  if (!key) throw new Error('API_JWT_SECRET is not set — see .env.example');
  return key;
}

export function signApiToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, secret(), { expiresIn: TOKEN_TTL_SECONDS, algorithm: 'HS256' });
}
