import { NextResponse } from 'next/server';
import { isTotpEnabled } from '@/lib/auth/totp';
import { requireSession } from '@/lib/auth/require-session';

export async function GET(): Promise<Response> {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  return NextResponse.json({ enabled: await isTotpEnabled(session.userId) });
}
