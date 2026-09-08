import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { authDb } from '@/lib/auth/db';
import { sendPasswordResetEmail } from '@/lib/auth/email';
import { clientIp, slidingWindowRateLimit } from '@/lib/auth/rate-limit';
import { users, verificationTokens } from '@/lib/auth/schema';

// Task 4's third named endpoint. Tightest limits of the three auth
// flows — a reset request is the cheapest possible action for an
// attacker to spam (no password to guess, just an email to submit),
// and the one most annoying to a real victim if abused (an inbox full
// of reset emails).
const IP_LIMIT = { limit: 5, windowSeconds: 15 * 60 };
const EMAIL_LIMIT = { limit: 3, windowSeconds: 60 * 60 };

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? '').toLowerCase().trim();
  if (!email) return NextResponse.json({ error: 'invalid_email' }, { status: 400 });

  const ip = clientIp(request.headers);
  const [ipCheck, emailCheck] = await Promise.all([
    slidingWindowRateLimit(`reset:ip:${ip}`, IP_LIMIT.limit, IP_LIMIT.windowSeconds),
    slidingWindowRateLimit(`reset:email:${email}`, EMAIL_LIMIT.limit, EMAIL_LIMIT.windowSeconds),
  ]);
  if (!ipCheck.allowed || !emailCheck.allowed) {
    return NextResponse.json({ error: 'rate_limited', message: 'Too many attempts — try again in a bit.' }, { status: 429 });
  }

  // Always the same response whether or not the email exists — the
  // same user-enumeration-oracle discipline as the login path (task 9).
  const genericResponse = NextResponse.json({
    ok: true,
    message: "If that email has an account, we've sent a reset link.",
  });

  const [user] = await authDb.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (!user) return genericResponse;

  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000);
  await authDb.insert(verificationTokens).values({ identifier: `password-reset:${email}`, token, expires });

  const resetUrl = `${process.env.AUTH_URL ?? 'http://localhost:3000'}/reset-password?email=${encodeURIComponent(email)}&token=${token}`;
  await sendPasswordResetEmail(email, resetUrl).catch((err) => console.error('[password-reset] send failed:', err.message));

  return genericResponse;
}
