/**
 * Day 24 task 2's mention parsing — flagged for override, per the
 * brief's own request.
 *
 * This app has no dedicated, unique, space-free "username" — identity
 * is `displayName` (optional free text, can contain spaces, can be
 * null) plus a generated `avatarSeed` (see Day 17's anonymity design).
 * A real @mention system usually assumes a handle exactly like Twitter/
 * Discord's, and building one (a new unique column, a migration
 * backfilling one per existing user, a UI to set/change it) is a real
 * feature in its own right, not a Day 24 side task.
 *
 * The v1 chosen here: `@token` where `token` is letters/digits/
 * underscore only (no spaces) — matched case-insensitively against
 * `displayName` for an *exact* match. This means:
 *   - A user with a single-word display name ("nightowl", "SneakerGuy99")
 *     is mentionable today, exactly as typed.
 *   - A user with a multi-word display name ("Alex Chen") is NOT
 *     mentionable by their full name (`@Alex Chen` isn't a token the
 *     regex below can even produce) — only reachable via `@Alex` or
 *     `@Chen` if that alone happens to equal someone's whole name,
 *     which it won't for "Alex Chen" specifically.
 *   - A user with no displayName set (shown elsewhere as "Collector
 *     xxxx") can't be mentioned at all.
 *
 * That's a real, disclosed limitation, not a bug — swap for a proper
 * username field if mentions need to work for every account.
 */
const MENTION_PATTERN = /@([A-Za-z0-9_]{2,32})\b/g;

/** Unique, lowercased candidate tokens — case-insensitive matching happens at the DB lookup, this just normalizes for de-duping. */
export function parseMentionTokens(text: string): string[] {
  const tokens = new Set<string>();
  for (const match of text.matchAll(MENTION_PATTERN)) {
    tokens.add(match[1]!.toLowerCase());
  }
  return [...tokens];
}
