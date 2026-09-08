/**
 * Seeds a handful of near-future test DropEvents so the real scheduler
 * (task 6's "let it run naturally, don't fake-trigger it") has
 * something genuine to pick up within the next few minutes. Not a
 * production seed — a throwaway fixture for today's manual end-to-end
 * test, safe to re-run (clears its own prior rows for these three
 * sneakers first, matched by sneaker + still-'upcoming', so repeat runs
 * don't pile up stale test drops).
 *
 * Three deliberately different shapes, to exercise real branches:
 *   1. Panda Dunk   — release_time 2 minutes out, standard FCFS,
 *      purchase_links populated. Should flip live and auto-post.
 *   2. Samba OG     — release_time 4 minutes out, raffle_info populated.
 *      Should flip live and auto-post with the raffle copy branch.
 *   3. New Balance 550 — release_time left NULL (TBA). Proves the
 *      scheduler's guard: a drop with no confirmed hour is never
 *      auto-flipped, no matter how much time passes.
 *
 *   npm run seed:test-drops --workspace=@chosn/api
 */
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { and, eq, inArray } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { dropEvents, sneakers } from '../db/schema';

const logger = new Logger('seed-test-drops');

const TARGET_STYLE_CODES = ['DD1391-100', 'B75806', 'BB550WT1'] as const;
const TEST_TIMEZONE = 'Asia/Kolkata';

/**
 * release_date/release_time are stored as naive (no offset) values that
 * the scheduler later reinterprets via `AT TIME ZONE release_timezone`
 * (0007's query) — so they must be the wall-clock date/time as seen IN
 * that zone, not in UTC or in this machine's local zone. Bug caught by
 * the first live run of this script: using toISOString()'s UTC
 * components against release_timezone: 'Asia/Kolkata' (UTC+5:30) put
 * the "2 minutes from now" drop 5.5 hours in the future instead. Using
 * Intl.DateTimeFormat with the target zone explicitly is what actually
 * fixes it, rather than hand-adding a fixed offset that would silently
 * break the moment a non-IST test zone is ever used here.
 */
function minutesFromNow(minutes: number): { date: string; time: string } {
  const at = new Date(Date.now() + minutes * 60_000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TEST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(at);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}:${get('second')}`,
  };
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const db = app.get<Db>(DRIZZLE);

    const rows = await db
      .select({ id: sneakers.id, styleCode: sneakers.styleCode, brand: sneakers.brand, model: sneakers.model })
      .from(sneakers)
      .where(inArray(sneakers.styleCode, [...TARGET_STYLE_CODES]));

    const byStyle = new Map(rows.map((r) => [r.styleCode, r]));
    for (const code of TARGET_STYLE_CODES) {
      if (!byStyle.has(code)) {
        logger.warn(`sneaker ${code} not found in catalog — skipping it (run the Day 6 seed migration first)`);
      }
    }

    // Clean up this script's own prior test rows for these sneakers,
    // still 'upcoming' only — never touch anything the real scheduler
    // already flipped live.
    const targetIds = [...byStyle.values()].map((r) => r.id);
    if (targetIds.length > 0) {
      const deleted = await db
        .delete(dropEvents)
        .where(and(inArray(dropEvents.sneakerId, targetIds), eq(dropEvents.status, 'upcoming')))
        .returning({ id: dropEvents.id });
      if (deleted.length > 0) logger.log(`cleared ${deleted.length} prior test drop(s)`);
    }

    const panda = byStyle.get('DD1391-100');
    const samba = byStyle.get('B75806');
    const nb550 = byStyle.get('BB550WT1');

    const inserts: (typeof dropEvents.$inferInsert)[] = [];

    if (panda) {
      const { date, time } = minutesFromNow(2);
      inserts.push({
        sneakerId: panda.id,
        releaseDate: date,
        releaseTime: time,
        releaseTimezone: TEST_TIMEZONE,
        regions: ['india'],
        retailPrice: '12995.00',
        currency: 'INR',
        status: 'upcoming',
        purchaseLinks: [
          { retailer_name: 'Nike SNKRS', url: 'https://www.nike.com/in/launch/t/dunk-low-panda', region: 'india' },
        ],
      });
    }

    if (samba) {
      const { date, time } = minutesFromNow(4);
      const closes = new Date(Date.now() + 3 * 60_000).toISOString();
      inserts.push({
        sneakerId: samba.id,
        releaseDate: date,
        releaseTime: time,
        releaseTimezone: TEST_TIMEZONE,
        regions: ['india', 'global'],
        retailPrice: '9999.00',
        currency: 'INR',
        status: 'upcoming',
        purchaseLinks: [],
        raffleInfo: {
          registration_url: 'https://www.adidas.co.in/confirmed',
          registration_closes_at: closes,
          method: 'adidas CONFIRMED',
        },
      });
    }

    if (nb550) {
      inserts.push({
        sneakerId: nb550.id,
        releaseDate: new Date().toISOString().slice(0, 10),
        releaseTime: null, // TBA — must never be auto-flipped
        releaseTimezone: TEST_TIMEZONE,
        regions: ['india'],
        retailPrice: '8999.00',
        currency: 'INR',
        status: 'upcoming',
        purchaseLinks: [],
      });
    }

    if (inserts.length === 0) {
      logger.error('no target sneakers found — nothing seeded');
      return;
    }

    const created = await db.insert(dropEvents).values(inserts).returning({
      id: dropEvents.id,
      sneakerId: dropEvents.sneakerId,
      releaseDate: dropEvents.releaseDate,
      releaseTime: dropEvents.releaseTime,
    });

    for (const row of created) {
      const sneaker = rows.find((r) => r.id === row.sneakerId);
      const label = sneaker ? `${sneaker.brand} ${sneaker.model}` : row.sneakerId;
      const timing = row.releaseTime ? `${row.releaseDate} ${row.releaseTime} IST` : `${row.releaseDate}, TBA (never auto-flips)`;
      logger.log(`seeded ${label} — ${timing} — id ${row.id}`);
    }

    logger.log('Watch the running API\'s logs (or GET /health/drops) for the scheduler picking these up.');
  } finally {
    await app.close();
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
