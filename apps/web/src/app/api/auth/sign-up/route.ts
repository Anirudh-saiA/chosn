import { NextResponse } from 'next/server';
import { createAccount } from '@/auth';
import { passwordMeetsMinimumStrength } from '@/lib/auth/password';
import { clientIp, slidingWindowRateLimit } from '@/lib/auth/rate-limit';

// Same reasoning as the login path in auth.ts — per-IP (broad abuse:
// scripted account creation) and per-account (repeated attempts
// against one specific email, e.g. probing whether it's already
// registered). Signup is naturally rarer than login for a real
// visitor, so both limits are tighter here (task 4).
const IP_LIMIT = { limit: 10, windowSeconds: 10 * 60 };
const EMAIL_LIMIT = { limit: 5, windowSeconds: 60 * 60 };

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? '').toLowerCase().trim();
  const password = String(body?.password ?? '');
  const name = body?.name ? String(body.name).slice(0, 200) : undefined;

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'invalid_email', message: 'That email looks invalid.' }, { status: 400 });
  }
  if (!passwordMeetsMinimumStrength(password)) {
    return NextResponse.json(
      { error: 'weak_password', message: 'Password needs to be at least 10 characters.' },
      { status: 400 },
    );
  }

  const ip = clientIp(request.headers);
  const [ipCheck, emailCheck] = await Promise.all([
    slidingWindowRateLimit(`signup:ip:${ip}`, IP_LIMIT.limit, IP_LIMIT.windowSeconds),
    slidingWindowRateLimit(`signup:email:${email}`, EMAIL_LIMIT.limit, EMAIL_LIMIT.windowSeconds),
  ]);
  if (!ipCheck.allowed || !emailCheck.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many attempts — try again in a bit.' },
      { status: 429 },
    );
  }

  const result = await createAccount(email, password, name);
  if (!result.ok) {
    // Same "an account with that email already exists" message
    // regardless of what actually went wrong server-side — createAccount
    // only ever returns this one user-facing reason today, but the
    // shape stays deliberately generic rather than echoing internals.
    return NextResponse.json({ error: 'signup_failed', message: result.error }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
