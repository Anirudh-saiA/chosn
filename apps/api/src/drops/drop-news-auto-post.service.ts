import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { eq } from 'drizzle-orm';
import Redis from 'ioredis';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { dropConsumerFailures, dropEvents, newsItems, sneakers } from '../db/schema';
import { bullConnection } from '../queue/queue.config';
import { buildAutoPostCopy } from './auto-post-template';
import { DROP_LIVE_CHANNEL, isDropLiveEvent } from './drop-events.pubsub';

const CONSUMER_NAME = 'news-feed-auto-post';

/**
 * The first — and today, only — consumer of `drop:live` (Day 12 spec,
 * Day 13 task 4): the moment a drop goes live, post the factual
 * announcement to the news feed automatically, `is_breaking = true`.
 *
 * A dedicated Redis connection, not the shared REDIS_CLIENT or the
 * scheduler's publisher connection: once `.subscribe()` is called, an
 * ioredis connection is locked into subscriber mode and can no longer
 * issue ordinary commands (the INSERT this consumer needs to do in
 * response uses the Drizzle/pg pool, never this connection, precisely
 * because of that restriction).
 */
@Injectable()
export class DropNewsAutoPostService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DropNewsAutoPostService.name);
  private subscriber?: Redis;

  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async onModuleInit(): Promise<void> {
    if (!process.env.DATABASE_URL) {
      this.logger.warn('DATABASE_URL unset — news auto-post consumer not started');
      return;
    }

    this.subscriber = new Redis(bullConnection());
    await this.subscriber.subscribe(DROP_LIVE_CHANNEL);
    this.subscriber.on('message', (channel, message) => {
      if (channel !== DROP_LIVE_CHANNEL) return;
      // Fire-and-forget by design: ioredis's 'message' handler isn't
      // awaited by the client itself, so a slow or failing handler must
      // never throw synchronously back into it. handle() catches
      // everything it can raise (task 5).
      void this.handle(message);
    });
    this.subscriber.on('error', (err) => {
      // A dropped subscriber connection would otherwise fail silently —
      // ioredis auto-reconnects and re-subscribes on its own, but this
      // makes the interruption visible rather than a quiet gap in
      // coverage during the outage.
      this.logger.error(`subscriber connection error: ${err.message}`);
      Sentry.captureException(err, { tags: { component: 'drop-news-auto-post-subscriber' } });
    });

    this.logger.log(`subscribed to ${DROP_LIVE_CHANNEL}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber?.quit();
  }

  private async handle(raw: string): Promise<void> {
    let event: unknown;
    try {
      event = JSON.parse(raw);
    } catch {
      this.logger.error(`malformed ${DROP_LIVE_CHANNEL} payload, not JSON: ${raw.slice(0, 200)}`);
      return;
    }
    if (!isDropLiveEvent(event)) {
      this.logger.error(`malformed ${DROP_LIVE_CHANNEL} payload, missing fields: ${raw.slice(0, 200)}`);
      return;
    }

    try {
      await this.createNewsItem(event.dropEventId);
    } catch (err) {
      // Isolated exactly like Day 6–7's retailer fetchers: a failure
      // here must never crash the subscriber connection or affect any
      // other consumer of the same channel (task 5). Logged, recorded
      // durably, and raised to Sentry — the same three-part response as
      // PriceFetchService.onFailed.
      const message = (err as Error).message;
      this.logger.error(`news auto-post failed for drop ${event.dropEventId}: ${message}`);
      Sentry.captureException(err, {
        tags: { component: CONSUMER_NAME },
        extra: { dropEventId: event.dropEventId },
      });
      try {
        await this.db.insert(dropConsumerFailures).values({
          consumer: CONSUMER_NAME,
          dropEventId: event.dropEventId,
          reason: message.slice(0, 500),
        });
      } catch (writeErr) {
        this.logger.warn(`could not record consumer failure: ${(writeErr as Error).message}`);
      }
    }
  }

  /**
   * Re-reads the drop's full detail from Postgres rather than trusting
   * anything beyond the id in the event payload — Day 12's spec is
   * explicit that this is the point of keeping the event minimal.
   */
  private async createNewsItem(dropEventId: string): Promise<void> {
    const [row] = await this.db
      .select({
        dropEventId: dropEvents.id,
        regions: dropEvents.regions,
        retailPrice: dropEvents.retailPrice,
        currency: dropEvents.currency,
        purchaseLinks: dropEvents.purchaseLinks,
        raffleInfo: dropEvents.raffleInfo,
        brand: sneakers.brand,
        model: sneakers.model,
        colorway: sneakers.colorway,
        styleCode: sneakers.styleCode,
      })
      .from(dropEvents)
      .innerJoin(sneakers, eq(sneakers.id, dropEvents.sneakerId))
      .where(eq(dropEvents.id, dropEventId))
      .limit(1);

    if (!row) {
      throw new Error(`drop_event ${dropEventId} not found — cannot auto-post`);
    }

    const { title, body } = buildAutoPostCopy({
      brand: row.brand,
      model: row.model,
      colorway: row.colorway,
      styleCode: row.styleCode,
      regions: row.regions,
      retailPrice: row.retailPrice,
      currency: row.currency,
      purchaseLinks: row.purchaseLinks,
      raffleInfo: row.raffleInfo,
    });

    try {
      await this.db.insert(newsItems).values({
        title,
        body,
        dropEventId: row.dropEventId,
        source: 'CHOSN (auto)',
        isBreaking: true,
      });
      this.logger.log(`auto-posted news item for drop ${row.dropEventId} (${row.brand} ${row.model})`);
    } catch (err) {
      // Postgres' own idempotency guard (news_items_auto_post_unique,
      // 0007) — a duplicate here means another instance's subscriber
      // already handled this exact event, not a real failure. See that
      // migration's header for why this can happen at all: Redis
      // Pub/Sub fans a message out to every subscriber, not one of
      // them, so this is the safety net for running more than one API
      // instance. Logged, not Sentried — this is expected, not broken.
      if ((err as { code?: string }).code === '23505') {
        this.logger.log(`auto-post for drop ${row.dropEventId} already exists — skipping`);
        return;
      }
      throw err;
    }
  }
}
