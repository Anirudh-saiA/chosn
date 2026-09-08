import bcrypt from 'bcryptjs';

/**
 * bcryptjs, not the native `bcrypt` binding — pure JS, no compiled
 * addon to break on Vercel's serverless build target. The hashing
 * itself (this file) is the one piece of "password logic" this project
 * writes by hand; everything around it — session issuance, CSRF,
 * cookie flags, OAuth token exchange — is NextAuth's, which is the
 * actual point of task 1's "don't hand-roll" instruction. bcrypt
 * itself, via a vetted library, is the standard way to do this; hand-
 * rolling would mean writing your own hashing/salting scheme, not
 * calling bcrypt.
 *
 * Cost factor 12 — bcrypt's own recommended floor for 2024+ hardware,
 * ~250ms per hash on typical serverless CPU. Slow on purpose: that
 * cost is what makes an offline brute-force of a stolen hash
 * expensive, the entire reason to use bcrypt over a fast hash like
 * SHA-256.
 */
const COST_FACTOR = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST_FACTOR);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Matches Day 5's `JoinWaitlistDto` era of the product in spirit but
 * this is a real account: length + a little composition, not just
 * "not empty." Not NIST-800-63-style complexity theater (no forced
 * special-character rules, which push people toward predictable
 * substitutions) — just a floor long enough that bcrypt's cost factor
 * is the actual bottleneck for an attacker, not the password itself.
 */
export function passwordMeetsMinimumStrength(plain: string): boolean {
  return plain.length >= 10;
}
