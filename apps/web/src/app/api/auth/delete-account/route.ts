import { NextResponse } from 'next/server';
import { authPool } from '@/lib/auth/db';
import { clientIp, slidingWindowRateLimit } from '@/lib/auth/rate-limit';
import { requireSession } from '@/lib/auth/require-session';
import { revokeAllSessions } from '@/lib/auth/session-revocation';

const LIMIT = { limit: 5, windowSeconds: 60 * 60 };

/**
 * Day 19 task 6 — real, self-serve erasure, not a "email us and we'll
 * get to it" process.
 *
 * The non-obvious part, and the reason this is a hand-written
 * transaction rather than a one-line `DELETE FROM users`: the schema's
 * foreign keys do NOT fully erase someone on their own.
 *
 *   - accounts, sessions, reports (as reporter), user_blocks
 *     -> ON DELETE CASCADE, so these go automatically. Good.
 *   - reports.reviewed_by -> ON DELETE SET NULL, deliberately: an
 *     admin deleting their own account must not wipe the moderation
 *     history of reports they actioned (see 0009_trust_safety.sql).
 *   - subscribers.user_id and waitlist_entries.linked_user_id
 *     -> ON DELETE SET NULL. **Those two rows hold the user's email
 *     address.** Deleting only the `users` row would leave their email
 *     sitting in two other tables while telling them they'd been
 *     deleted — which would make this feature a lie, and a DPDP Act
 *     erasure failure. So both are explicitly deleted here, matched on
 *     the account's email.
 *
 * Deleting the subscriber row also cascades its notification
 * subscriptions and web push registrations, which is what closes out
 * "stop sending me things" as part of "delete me."
 */
export async function POST(request: Request): Promise<Response> {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const ip = clientIp(request.headers);
  const check = await slidingWindowRateLimit(`delete-account:${session.userId}:${ip}`, LIMIT.limit, LIMIT.windowSeconds);
  if (!check.allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  // Typed confirmation, matched server-side — a destructive,
  // irreversible action shouldn't be one stray click.
  const body = await request.json().catch(() => null);
  if (body?.confirm !== 'DELETE') {
    return NextResponse.json(
      { error: 'confirmation_required', message: 'Type DELETE to confirm.' },
      { status: 400 },
    );
  }

  const client = await authPool.connect();
  try {
    await client.query('BEGIN');

    // Cascades: notification_subscriptions, web_push_subscriptions.
    await client.query('DELETE FROM subscribers WHERE user_id = $1 OR email = $2', [
      session.userId,
      session.email,
    ]);

    await client.query('DELETE FROM waitlist_entries WHERE linked_user_id = $1 OR email = $2', [
      session.userId,
      session.email,
    ]);

    // Cascades: accounts, sessions, reports (as reporter), user_blocks.
    const result = await client.query('DELETE FROM users WHERE id = $1', [session.userId]);

    await client.query('COMMIT');

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[delete-account] failed, rolled back:', (err as Error).message);
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  } finally {
    client.release();
  }

  // The session cookie is a JWT — deleting the row doesn't invalidate a
  // token already in the browser. Day 16's Redis denylist is what
  // actually kills it, so a deleted account can't keep making
  // authenticated calls with a token minted moments earlier.
  await revokeAllSessions(session.userId);

  return NextResponse.json({ ok: true });
}
