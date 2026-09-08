import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { eq, or, sql } from 'drizzle-orm';
import Redis from 'ioredis';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { dropConsumerFailures, dropEvents, notificationSubscriptions, sneakers, webPushSubscriptions } from '../db/schema';
import { bullConnection } from '../queue/queue.config';
import { DROP_LIVE_CHANNEL, isDropLiveEvent } from './drop-events.pubsub';
import { WebPushService } from './web-push.service';

const CONSUMER_NAME = 'web-push';
/** Batch size for fan-out sends — task 7: never one massive synchronous loop for a popular drop. */
const SEND_BATCH_SIZE = 20;

interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * The third consumer of `drop:live` (Day 12's design, Day 13's channel):
 * push notifications for subscribed users who aren't currently on the
 * site. Own dedicated Redis subscriber connection and its own
 * try/catch boundary, same isolation pattern as the news auto-post
 * consumer and the WebSocket gateway — a slow or failing push send
 * must never block or fail either of the other two.
 */
@Injectable()
export class DropPushConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DropPushConsumer.name);
  private subscriber?: Redis;

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly webPush: WebPushService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!process.env.DATABASE_URL) {
      this.logger.warn('DATABASE_URL unset — web push consumer not started');
      return;
    }

    this.subscriber = new Redis(bullConnection());
    await this.subscriber.subscribe(DROP_LIVE_CHANNEL);
    this.subscriber.on('message', (channel, message) => {
      if (channel !== DROP_LIVE_CHANNEL) return;
      void this.handle(message);
    });
    this.subscriber.on('error', (err) => {
      this.logger.error(`subscriber connection error: ${err.message}`);
      Sentry.captureException(err, { tags: { component: `${CONSUMER_NAME}-subscriber` } });
    });

    if (!this.webPush.configured) {
      this.logger.warn(`subscribed to ${DROP_LIVE_CHANNEL}, but VAPID keys are unset — sends will no-op`);
    } else {
      this.logger.log(`subscribed to ${DROP_LIVE_CHANNEL}`);
    }
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
      await this.notifyMatchingSubscribers(event.dropEventId);
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(`push fan-out failed for drop ${event.dropEventId}: ${message}`);
      Sentry.captureException(err, { tags: { component: CONSUMER_NAME }, extra: { dropEventId: event.dropEventId } });
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

  private async notifyMatchingSubscribers(dropEventId: string): Promise<void> {
    const [drop] = await this.db
      .select({
        brand: sneakers.brand,
        model: sneakers.model,
        colorway: sneakers.colorway,
        styleCode: sneakers.styleCode,
      })
      .from(dropEvents)
      .innerJoin(sneakers, eq(sneakers.id, dropEvents.sneakerId))
      .where(eq(dropEvents.id, dropEventId))
      .limit(1);

    if (!drop) throw new Error(`drop_event ${dropEventId} not found — cannot notify`);

    // brand match OR model (style_code) match OR every 'global' row —
    // exactly the three scopes Day 12 designed.
    const rows = await this.db
      .select({
        endpoint: webPushSubscriptions.endpoint,
        p256dh: webPushSubscriptions.p256dh,
        auth: webPushSubscriptions.auth,
      })
      .from(notificationSubscriptions)
      .innerJoin(webPushSubscriptions, eq(webPushSubscriptions.subscriberId, notificationSubscriptions.subscriberId))
      .where(
        or(
          sql`${notificationSubscriptions.scopeType} = 'brand' AND ${notificationSubscriptions.scopeValue} = ${drop.brand}`,
          sql`${notificationSubscriptions.scopeType} = 'model' AND ${notificationSubscriptions.scopeValue} = ${drop.styleCode}`,
          sql`${notificationSubscriptions.scopeType} = 'global'`,
        ),
      );

    // A subscriber matched on more than one scope (e.g. following both
    // "Nike" and this exact model) must only get one push, not one per
    // matching row — de-dupe on endpoint, the actual delivery target.
    const targets = new Map<string, PushTarget>();
    for (const r of rows) targets.set(r.endpoint, r);

    if (targets.size === 0) {
      this.logger.log(`no push subscribers matched drop ${dropEventId} (${drop.brand} ${drop.model})`);
      return;
    }

    const payload = {
      title: `${drop.brand} ${drop.model} is live`,
      body: `"${drop.colorway}" (${drop.styleCode}) just dropped.`,
      dropEventId,
      styleCode: drop.styleCode,
    };

    const outcomes = await this.sendBatched([...targets.values()], payload);

    const sent = outcomes.filter((o) => o.status === 'sent').length;
    const gone = outcomes.filter((o) => o.status === 'gone').length;
    const failed = outcomes.filter((o) => o.status === 'error').length;
    this.logger.log(
      `push for drop ${dropEventId}: ${sent} sent, ${gone} stale (removed), ${failed} failed, ${targets.size} matched`,
    );
  }

  /**
   * Task 7: batched, not one massive synchronous/unbounded-concurrent
   * loop. Fixed-size chunks sent concurrently within each chunk, chunks
   * processed one after another — bounds how many outbound push
   * requests are ever in flight at once for a very popular drop,
   * instead of firing every send for the whole match set simultaneously.
   * Plain Promise.all is safe per chunk: WebPushService.send() never
   * rejects (every outcome, including failure, comes back as a typed
   * result — see its own doc comment), so one bad endpoint can't throw
   * and abort its sibling sends in the same chunk either.
   */
  private async sendBatched(
    targets: PushTarget[],
    payload: Record<string, unknown>,
  ): Promise<Array<{ status: 'sent' | 'gone' | 'error' }>> {
    const results: Array<{ status: 'sent' | 'gone' | 'error' }> = [];

    for (let i = 0; i < targets.length; i += SEND_BATCH_SIZE) {
      const batch = targets.slice(i, i + SEND_BATCH_SIZE);
      const outcomes = await Promise.all(
        batch.map(async (target) => {
          const outcome = await this.webPush.send(
            { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
            payload,
          );
          if (outcome.status === 'gone') {
            // The browser's own push service says this endpoint will
            // never work again — clean up rather than retry it on
            // every future drop. Best-effort: a failed delete here
            // just means one stale row survives until the next miss.
            await this.db
              .delete(webPushSubscriptions)
              .where(eq(webPushSubscriptions.endpoint, target.endpoint))
              .catch(() => undefined);
          } else if (outcome.status === 'error') {
            this.logger.warn(`push send failed for one endpoint: ${outcome.message}`);
          }
          return { status: outcome.status };
        }),
      );
      results.push(...outcomes);
    }

    return results;
  }
}
