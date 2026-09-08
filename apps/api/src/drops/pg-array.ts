/**
 * Parses a Postgres array literal (`{india,global}`) into a JS array.
 *
 * Needed only for raw `db.execute(sql\`...\`)` queries — real bug caught
 * while building Day 15's list endpoint: Drizzle's *typed* query builder
 * (`.select({ regions: dropEvents.regions })`) correctly returns a real
 * JS array for `region[]`, because Drizzle's own column definition knows
 * how to (de)serialize it. Raw `execute()` bypasses that entirely and
 * returns whatever node-postgres's OID-based type parser gives back —
 * and node-postgres has no built-in parser for a *custom enum* array
 * type (unlike `text[]`/`int[]`), so it falls through to the raw text
 * representation. This affected the existing `by-style-code` endpoint
 * from Day 14 too, not just new Day 15 code — confirmed by testing the
 * same column through both code paths directly against real Postgres
 * (see drops/README.md's Day 15 section).
 *
 * `regions` only ever holds the three unquoted, comma-safe values in
 * the `region` enum (`india`/`us`/`global`) — no escaping/quoting logic
 * needed for Postgres's general array-literal grammar, which this
 * deliberately doesn't implement.
 */
export function parsePgTextArray(raw: string | null): string[] {
  if (!raw) return [];
  const inner = raw.replace(/^\{/, '').replace(/\}$/, '');
  if (inner.length === 0) return [];
  return inner.split(',').map((s) => s.trim());
}
