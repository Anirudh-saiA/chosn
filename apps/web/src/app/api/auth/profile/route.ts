import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { authDb } from '@/lib/auth/db';
import { requireSession } from '@/lib/auth/require-session';
import { users } from '@/lib/auth/schema';

/**
 * Task 3's own settings surface — display_name and avatar_seed, the
 * only two identity fields this app should ever let a user hand to
 * other people once a community feature exists (see
 * docs/trust-and-safety/README.md's anonymity audit). Real name and
 * email never appear here; there is nothing in this route that can
 * touch either.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const body = await request.json().catch(() => null);
  const action = body?.action;

  if (action === 'set_display_name') {
    const displayName = typeof body?.displayName === 'string' ? body.displayName.trim().slice(0, 40) : '';
    await authDb
      .update(users)
      .set({ displayName: displayName || null })
      .where(eq(users.id, session.userId));
    return NextResponse.json({ ok: true, displayName: displayName || null });
  }

  if (action === 'reroll_avatar') {
    const avatarSeed = randomUUID();
    await authDb.update(users).set({ avatarSeed }).where(eq(users.id, session.userId));
    return NextResponse.json({ ok: true, avatarSeed });
  }

  return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
}
