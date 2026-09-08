import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { authDb } from '@/lib/auth/db';
import { hashPassword, passwordMeetsMinimumStrength } from '@/lib/auth/password';
import { clientIp, slidingWindowRateLimit } from '@/lib/auth/rate-limit';
import { users, verificationTokens } from '@/lib/auth/schema';
import { revokeAllSessions } from '@/lib/auth/session-revocation';

const IP_LIMIT = { limit: 10, windowSeconds: 15 * 60 };

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? '').toLowerCase().trim();
  const token = String(body?.token ?? '');
  const newPassword = String(body?.newPassword ?? '');

  if (!email || !token) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  if (!passwordMeetsMinimumStrength(newPassword)) {
    return NextResponse.json(
      { error: 'weak_password', message: 'Password needs to be at least 10 characters.' },
      { status: 400 },
    );
  }

  const ip = clientIp(request.headers);
  const ipCheck = await slidingWindowRateLimit(`reset-confirm:ip:${ip}`, IP_LIMIT.limit, IP_LIMIT.windowSeconds);
  if (!ipCheck.allowed) {
    return NextResponse.json({ error: 'rate_limited', message: 'Too many attempts — try again in a bit.' }, { status: 429 });
  }

  const identifier = `password-reset:${email}`;
  const [record] = await authDb
    .select()
    .from(verificationTokens)
    .where(and(eq(verificationTokens.identifier, identifier), eq(verificationTokens.token, token)))
    .limit(1);

  // Single-use: the row is deleted here regardless of whether it was
  // still valid, so a token can never be replayed even if this request
  // fails some other check below.
  if (record) {
    await authDb
      .delete(verificationTokens)
      .where(and(eq(verificationTokens.identifier, identifier), eq(verificationTokens.token, token)));
  }

  if (!record || record.expires < new Date()) {
    return NextResponse.json(
      { error: 'invalid_token', message: 'That reset link is invalid or has expired — request a new one.' },
      { status: 400 },
    );
  }

  const passwordHash = await hashPassword(newPassword);
  const [updated] = await authDb
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.email, email))
    .returning({ id: users.id });

  // A password change is exactly the moment every *other* session
  // (a stolen laptop, a leaked cookie) should stop working — the real
  // point of session-revocation.ts existing at all.
  if (updated) await revokeAllSessions(updated.id);

  return NextResponse.json({ ok: true });
}
