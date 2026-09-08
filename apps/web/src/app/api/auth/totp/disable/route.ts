import { NextResponse } from 'next/server';
import { disableTotp } from '@/lib/auth/totp';
import { requireSession } from '@/lib/auth/require-session';

export async function POST(): Promise<Response> {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  await disableTotp(session.userId);
  return NextResponse.json({ ok: true });
}
