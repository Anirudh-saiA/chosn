/**
 * Day 15 demo data — spreads a few more upcoming drops across real
 * future dates (including into next month, so the calendar view has
 * more than one month worth looking at) and adds a couple of hand-
 * written editorial NewsItems alongside the real auto-posted ones
 * already in the database from actually running the Day 13/14
 * scheduler. Doesn't touch or duplicate those — this only adds rows
 * for the two catalog sneakers that don't have a drop_event yet.
 *
 * Not a replacement for seed-test-drops.ts (Day 13's near-future
 * scheduler test fixture) — this is demo/browse content, not a timing
 * test. Safe to re-run: clears its own prior rows for these two
 * sneakers first.
 *
 *   npm run seed:demo-drops --workspace=@chosn/api
 */
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { and, eq, inArray } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { dropEvents, newsItems, sneakers } from '../db/schema';

const logger = new Logger('seed-demo-drops');

function daysFromNowIST(days: number, time: string): { date: string; time: string } {
  const at = new Date(Date.now() + days * 24 * 60 * 60_000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time };
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'warn', 'error'] });

  try {
    const db = app.get<Db>(DRIZZLE);

    const rows = await db
      .select({ id: sneakers.id, styleCode: sneakers.styleCode, brand: sneakers.brand, model: sneakers.model })
      .from(sneakers)
      .where(inArray(sneakers.styleCode, ['CW2288-111', 'HQ8708']));
    const byStyle = new Map(rows.map((r) => [r.styleCode, r]));

    const targetIds = [...byStyle.values()].map((r) => r.id);
    if (targetIds.length > 0) {
      const deleted = await db
        .delete(dropEvents)
        .where(and(inArray(dropEvents.sneakerId, targetIds), eq(dropEvents.status, 'upcoming')))
        .returning({ id: dropEvents.id });
      if (deleted.length > 0) logger.log(`cleared ${deleted.length} prior demo drop(s)`);
    }

    const inserts: (typeof dropEvents.$inferInsert)[] = [];

    const af1 = byStyle.get('CW2288-111');
    if (af1) {
      const { date, time } = daysFromNowIST(5, '10:00:00');
      inserts.push({
        sneakerId: af1.id,
        releaseDate: date,
        releaseTime: time,
        releaseTimezone: 'Asia/Kolkata',
        regions: ['india'],
        retailPrice: '9295.00',
        currency: 'INR',
        status: 'upcoming',
        purchaseLinks: [{ retailer_name: 'Nike.com', url: 'https://www.nike.com/in/launch/t/air-force-1-07-white', region: 'india' }],
      });
    }

    const campus = byStyle.get('HQ8708');
    if (campus) {
      const { date } = daysFromNowIST(18, '00:00:00'); // ~18 days out, likely spills into next month for the calendar view
      inserts.push({
        sneakerId: campus.id,
        releaseDate: date,
        releaseTime: null, // TBA — realistic, not every drop has a confirmed hour this far out
        releaseTimezone: 'Asia/Kolkata',
        regions: ['india', 'global'],
        retailPrice: '8499.00',
        currency: 'INR',
        status: 'upcoming',
        purchaseLinks: [],
      });
    }

    const created = inserts.length > 0 ? await db.insert(dropEvents).values(inserts).returning({ id: dropEvents.id, sneakerId: dropEvents.sneakerId }) : [];
    for (const row of created) {
      const sneaker = rows.find((r) => r.id === row.sneakerId);
      logger.log(`seeded ${sneaker ? `${sneaker.brand} ${sneaker.model}` : row.sneakerId} — id ${row.id}`);
    }

    // A couple of hand-written editorial posts (Day 12's hybrid content
    // strategy's human half) — one attached to the already-live Panda
    // Dunk drop (alongside its real auto-post, demonstrating the two
    // coexisting), one general/ambient with no drop_event_id at all.
    const [livePanda] = await db
      .select({ id: dropEvents.id })
      .from(dropEvents)
      .innerJoin(sneakers, eq(sneakers.id, dropEvents.sneakerId))
      .where(and(eq(sneakers.styleCode, 'DD1391-100'), eq(dropEvents.status, 'live')))
      .limit(1);

    const existingEditorial = await db
      .select({ id: newsItems.id })
      .from(newsItems)
      .where(eq(newsItems.source, 'CHOSN editorial'));

    if (existingEditorial.length === 0) {
      const editorialInserts: (typeof newsItems.$inferInsert)[] = [
        {
          title: "Why the Panda Dunk still moves the way it does",
          body: 'Three years since its first re-release and the White/Black Dunk Low still clears out of every drop within the hour. The pairing works because it does not try to — a plain colorway on a shape that was never trying to be loud in the first place.',
          dropEventId: livePanda?.id ?? null,
          source: 'CHOSN editorial',
          isBreaking: false,
        },
        {
          title: 'What we look for before we trust a restock rumor',
          body: "A retailer teaser is not a confirmed date. Before a drop shows up on this calendar, we want a real release window from the brand or the retailer directly — not a screenshot making the rounds. It is slower, but it means what is listed here is worth checking your size against, not worth checking twice.",
          dropEventId: null,
          source: 'CHOSN editorial',
          isBreaking: false,
        },
      ];
      const createdNews = await db.insert(newsItems).values(editorialInserts).returning({ id: newsItems.id, title: newsItems.title });
      for (const n of createdNews) logger.log(`seeded editorial post "${n.title}" — id ${n.id}`);
    } else {
      logger.log('editorial posts already seeded — skipping');
    }
  } finally {
    await app.close();
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
