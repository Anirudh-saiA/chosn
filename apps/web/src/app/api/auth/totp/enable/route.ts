import { NextResponse } from 'next/server';
import { enableTotp } from '@/lib/auth/totp';
import { requireSession } from '@/lib/auth/require-session';
import { clientIp, slidingWindowRateLimit } from '@/lib/auth/rate-limit';

const LIMIT = { limit: 10, windowSeconds: 10 * 60 };

export async function POST(request: Request): Promise<Response> {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const ip = clientIp(request.headers);
  const check = await slidingWindowRateLimit(`totp-enable:${session.userId}:${ip}`, LIMIT.limit, LIMIT.windowSeconds);
  if (!check.allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const secretBase32 = String(body?.secretBase32 ?? '');
  const code = String(body?.code ?? '');
  if (!secretBase32 || !code) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const enabled = await enableTotp(session.userId, session.email, secretBase32, code);
  if (!enabled) {
    return NextResponse.json({ error: 'invalid_code', message: "That code didn't match — try again." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
