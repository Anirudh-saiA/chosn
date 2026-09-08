import * as OTPAuth from 'otpauth';
import { sql } from 'drizzle-orm';
import { authDb } from './db';

/**
 * TOTP (task 2), opt-in, never required for v1 — a person can use
 * CHOSN fully without ever seeing this. `otpauth` implements the
 * standard RFC 6238 algorithm (same one Google Authenticator, Authy,
 * 1Password etc. all speak) — not hand-rolled, and interoperable with
 * whatever authenticator app someone already has.
 *
 * The secret is never stored in the clear. `pgp_sym_encrypt`/`_decrypt`
 * (pgcrypto, already enabled on this database since Day 1) with
 * TOTP_ENCRYPTION_KEY, an apps/web-only env var never sent to the
 * browser and never shared with apps/api — a stolen database dump
 * alone can't produce working codes; the application-side key is also
 * required, and the two live in different places (Vercel vs. the
 * database backup).
 */

function encryptionKey(): string {
  const key = process.env.TOTP_ENCRYPTION_KEY;
  if (!key) throw new Error('TOTP_ENCRYPTION_KEY is not set — see .env.example');
  return key;
}

function newTotp(email: string, secret?: OTPAuth.Secret): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: 'CHOSN',
    label: email,
    algorithm: 'SHA1', // the one every mainstream authenticator app actually supports — SHA256/512 are RFC-legal but poorly supported client-side
    digits: 6,
    period: 30,
    secret: secret ?? new OTPAuth.Secret({ size: 20 }),
  });
}

/** Generates a new secret and its otpauth:// URI (for a QR code) — not yet persisted or enabled. Enrollment finishes only once the user proves they can generate a valid code from it (see `enableTotp`). */
export function generateTotpEnrollment(email: string): { secretBase32: string; otpauthUri: string } {
  const totp = newTotp(email);
  return { secretBase32: totp.secret.base32, otpauthUri: totp.toString() };
}

function verifyCode(secretBase32: string, email: string, code: string): boolean {
  const totp = newTotp(email, OTPAuth.Secret.fromBase32(secretBase32));
  // window: 1 — accepts the previous/next 30s step too, the standard
  // tolerance for clock drift between the server and someone's phone.
  return totp.validate({ token: code, window: 1 }) !== null;
}

/** The enrollment step: proves the user's authenticator app is actually configured correctly before turning MFA on. */
export async function enableTotp(userId: string, email: string, secretBase32: string, code: string): Promise<boolean> {
  if (!verifyCode(secretBase32, email, code)) return false;

  await authDb.execute(sql`
    UPDATE users
    SET totp_enabled = true,
        totp_secret_encrypted = pgp_sym_encrypt(${secretBase32}, ${encryptionKey()}),
        updated_at = now()
    WHERE id = ${userId}
  `);
  return true;
}

export async function disableTotp(userId: string): Promise<void> {
  await authDb.execute(sql`
    UPDATE users
    SET totp_enabled = false, totp_secret_encrypted = NULL, updated_at = now()
    WHERE id = ${userId}
  `);
}

/** Used at login, once a password has already been verified — the second factor. */
export async function verifyTotpForLogin(userId: string, email: string, code: string): Promise<boolean> {
  const { rows } = await authDb.execute(sql`
    SELECT pgp_sym_decrypt(totp_secret_encrypted, ${encryptionKey()}) AS secret
    FROM users
    WHERE id = ${userId} AND totp_enabled = true
  `);
  const row = rows[0] as { secret: string } | undefined;
  if (!row?.secret) return false;
  return verifyCode(row.secret, email, code);
}

export async function isTotpEnabled(userId: string): Promise<boolean> {
  const { rows } = await authDb.execute(sql`SELECT totp_enabled FROM users WHERE id = ${userId}`);
  return Boolean((rows[0] as { totp_enabled?: boolean } | undefined)?.totp_enabled);
}
