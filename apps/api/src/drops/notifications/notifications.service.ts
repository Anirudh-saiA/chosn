import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../../db/drizzle.provider';
import { notificationSubscriptions, sneakers, subscribers, webPushSubscriptions } from '../../db/schema';
import type { SubscriptionScope } from './dto/subscription.dto';

export interface SubscriptionListItem {
  id: string;
  scopeType: SubscriptionScope;
  scopeValue: string | null;
  /** Friendly label for the settings page — "Nike" for brand, "Nike Dunk Low" for model, "Everything" for global. */
  label: string;
  createdAt: string;
}

/**
 * Owns `subscribers` / `notification_subscriptions` / `web_push_subscriptions`
 * — the identity + subscription rows Day 12 designed and Day 13's
 * consumers already read from. Nothing here talks to Redis or BullMQ;
 * that's DropSchedulerService's and the new consumers' job.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  /**
   * Reuses an existing subscriber row for a known email rather than
   * minting a duplicate identity every time the same person re-visits
   * and re-identifies — email is the only natural key this bare
   * identity model has.
   */
  async identify(email?: string): Promise<{ subscriberId: string }> {
    if (email) {
      const normalized = email.toLowerCase().trim();
      const [existing] = await this.db
        .select({ id: subscribers.id })
        .from(subscribers)
        .where(eq(subscribers.email, normalized))
        .limit(1);
      if (existing) return { subscriberId: existing.id };

      const [created] = await this.db
        .insert(subscribers)
        .values({ email: normalized })
        .returning({ id: subscribers.id });
      if (!created) throw new Error('subscriber insert returned no row');
      return { subscriberId: created.id };
    }

    const [created] = await this.db.insert(subscribers).values({}).returning({ id: subscribers.id });
    if (!created) throw new Error('subscriber insert returned no row');
    return { subscriberId: created.id };
  }

  private async assertSubscriberExists(subscriberId: string): Promise<void> {
    const [row] = await this.db
      .select({ id: subscribers.id })
      .from(subscribers)
      .where(eq(subscribers.id, subscriberId))
      .limit(1);
    if (!row) {
      // A stale subscriberId (e.g. someone's localStorage survived a
      // dev-database reset) should read as "you're not identified
      // anymore", not a generic 500 — the frontend re-runs identify()
      // and retries on this specific error.
      throw new NotFoundException({
        error: 'unknown_subscriber',
        message: 'That subscriber id is no longer recognized — please re-identify.',
      });
    }
  }

  /**
   * Raw SQL, not Drizzle's .onConflictDoNothing() — the unique index
   * this needs to target (0006's notification_subscriptions_unique) is
   * an expression index (COALESCE(scope_value, '')), and ON CONFLICT
   * against an expression index must name that exact expression, which
   * Drizzle's typed conflict-target builder has no way to express.
   * Verified directly against Postgres (see drops/README.md's Day 14
   * verification section) rather than assumed correct.
   */
  async subscribe(subscriberId: string, scopeType: SubscriptionScope, scopeValue: string | null): Promise<void> {
    await this.assertSubscriberExists(subscriberId);
    await this.db.execute(sql`
      INSERT INTO notification_subscriptions (subscriber_id, scope_type, scope_value)
      VALUES (${subscriberId}, ${scopeType}, ${scopeValue})
      ON CONFLICT (subscriber_id, scope_type, (COALESCE(scope_value, '')))
      DO NOTHING
    `);
  }

  async unsubscribe(subscriberId: string, scopeType: SubscriptionScope, scopeValue: string | null): Promise<void> {
    await this.db
      .delete(notificationSubscriptions)
      .where(
        and(
          eq(notificationSubscriptions.subscriberId, subscriberId),
          eq(notificationSubscriptions.scopeType, scopeType),
          scopeValue === null
            ? isNull(notificationSubscriptions.scopeValue)
            : eq(notificationSubscriptions.scopeValue, scopeValue),
        ),
      );
  }

  /**
   * For the settings page — every active subscription for one
   * subscriber, with a friendly label rather than a raw style code. One
   * extra query to resolve model-scoped style codes to "Brand Model";
   * brand/global rows need no lookup at all.
   */
  async list(subscriberId: string): Promise<SubscriptionListItem[]> {
    const rows = await this.db
      .select({
        id: notificationSubscriptions.id,
        scopeType: notificationSubscriptions.scopeType,
        scopeValue: notificationSubscriptions.scopeValue,
        createdAt: notificationSubscriptions.createdAt,
      })
      .from(notificationSubscriptions)
      .where(eq(notificationSubscriptions.subscriberId, subscriberId))
      .orderBy(notificationSubscriptions.createdAt);

    const modelCodes = rows.filter((r) => r.scopeType === 'model').map((r) => r.scopeValue as string);
    const modelLabels = new Map<string, string>();
    if (modelCodes.length > 0) {
      const sneakerRows = await this.db
        .select({ styleCode: sneakers.styleCode, brand: sneakers.brand, model: sneakers.model })
        .from(sneakers)
        .where(inArray(sneakers.styleCode, modelCodes));
      for (const s of sneakerRows) modelLabels.set(s.styleCode, `${s.brand} ${s.model}`);
    }

    return rows.map((r) => ({
      id: r.id,
      scopeType: r.scopeType as SubscriptionScope,
      scopeValue: r.scopeValue,
      label:
        r.scopeType === 'global'
          ? 'Everything'
          : r.scopeType === 'brand'
            ? (r.scopeValue as string)
            : (modelLabels.get(r.scopeValue as string) ?? (r.scopeValue as string)),
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /**
   * `endpoint` carries a plain (non-expression) UNIQUE constraint, so a
   * normal Drizzle onConflictDoUpdate works here — unlike subscribe()
   * above. One browser re-registering (a renewed push subscription,
   * same endpoint) updates its keys in place rather than erroring.
   */
  async pushSubscribe(subscriberId: string, endpoint: string, p256dh: string, auth: string): Promise<void> {
    await this.assertSubscriberExists(subscriberId);
    await this.db
      .insert(webPushSubscriptions)
      .values({ subscriberId, endpoint, p256dh, auth })
      .onConflictDoUpdate({
        target: webPushSubscriptions.endpoint,
        set: { subscriberId, p256dh, auth },
      });
  }

  async pushUnsubscribe(endpoint: string): Promise<void> {
    await this.db.delete(webPushSubscriptions).where(eq(webPushSubscriptions.endpoint, endpoint));
  }
}
