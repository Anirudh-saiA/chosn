import { NextResponse } from 'next/server';
import { auth } from '@/auth';

/** Shared guard for every authenticated Route Handler under /api/auth/totp/* and similar — one 401 shape, not re-implemented per route. */
export async function requireSession(): Promise<{ userId: string; email: string } | NextResponse> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const email = session?.user?.email;
  if (!userId || !email) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  return { userId, email };
}
