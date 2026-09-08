import { authPool } from './db';

/**
 * Day 16 task 3 — "link existing emails to new auth accounts on first
 * real login," done exactly that literally: called from auth.ts's
 * `signIn` event, every time, for every provider. Idempotent by
 * construction (`WHERE linked_user_id IS NULL` / `WHERE user_id IS
 * NULL`), so running it on every login rather than as a one-time batch
 * job is simpler and can't double-link or race a batch job that ran
 * concurrently.
 *
 * Two separate tables, two separate signals worth not losing:
 * - `waitlist_entries` (Day 5) — the "how many waitlist signups
 *   actually became real accounts" question this makes answerable.
 * - `subscribers` (Day 12) — an anonymous "notify me" identity that
 *   happened to include an email. Only the email-bearing subscriber
 *   rows are linked this way; a subscriber that only ever had a bare
 *   browser-local push subscription (no email at all) has nothing to
 *   match on and stays anonymous — a real, disclosed gap, not silently
 *   dropped (see drops/README.md's Day 16 section).
 *
 * A raw `pg` query via `authPool` (lib/auth/db.ts's own connection),
 * not a second pool — these two tables aren't part of the Auth.js
 * adapter's schema and don't need Drizzle's typed builder for two
 * simple UPDATE statements, but they're still the same database this
 * process already holds one pool for; opening a second would just be
 * another idle connection for no reason.
 */
export async function reconcileLegacyRecords(userId: string, email: string): Promise<void> {
  const normalized = email.toLowerCase().trim();

  await Promise.all([
    authPool
      .query(`UPDATE waitlist_entries SET linked_user_id = $1 WHERE email = $2 AND linked_user_id IS NULL`, [
        userId,
        normalized,
      ])
      .catch((err) => console.error('[reconcile] waitlist_entries link failed:', (err as Error).message)),
    authPool
      .query(`UPDATE subscribers SET user_id = $1 WHERE email = $2 AND user_id IS NULL`, [userId, normalized])
      .catch((err) => console.error('[reconcile] subscribers link failed:', (err as Error).message)),
  ]);
}
