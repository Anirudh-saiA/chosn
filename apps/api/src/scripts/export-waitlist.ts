/**
 * Writes the whole waitlist to an Excel file.
 *
 *   node --env-file=.env dist/scripts/export-waitlist.js [out.xlsx]
 *
 * Default: data/waitlist/waitlist.xlsx at the repo root. Needs DATABASE_URL. The API also keeps this file up to date as
 * people join; use this to rebuild it from the database at any time.
 */
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { writeWorkbook } from '../waitlist/waitlist-sheet';

async function main() {
  const out = process.argv[2] ?? resolve(process.cwd(), '../../data/waitlist/waitlist.xlsx');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query(
      'SELECT joined_at, name, email, phone, interests, tracked_shoes, source, unsubscribed_at FROM waitlist_entries ORDER BY joined_at',
    );
    await writeWorkbook(
      out,
      rows.map((r) => ({
        joinedAt: r.joined_at as Date,
        name: (r.name as string | null) ?? '',
        email: r.email as string,
        phone: (r.phone as string | null) ?? null,
        interests: (r.interests as string[] | null) ?? [],
        shoes: (r.tracked_shoes as string[] | null) ?? [],
        source: r.source as string,
        unsubscribed: r.unsubscribed_at !== null,
      })),
    );
    console.log(`${rows.length} signup(s) written to ${out}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
