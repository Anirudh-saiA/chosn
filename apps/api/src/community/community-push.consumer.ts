import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { eq } from 'drizzle-orm';
import Redis from 'ioredis';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { subscribers, webPushSubscriptions } from '../db/schema';
import { WebPushService } from '../drops/web-push.service';
import { bullConnection } from '../queue/queue.config';
import { COMMUNITY_NOTIFY_CHANNEL, isCommunityNotifyEvent } from './community-notifications.pubsub';
import { CommunityNotificationsService } from './community-notifications.service';

const CONSUMER_NAME = 'community-push';

/**
 * Push delivery only — mirrors DropPushConsumer's shape (own dedicated
 * subscriber connection, own failure isolation) applied to Day 24's
 * point-to-point notifications instead of Day 13's topic broadcast. The
 * durable `community_notifications` row already exists by the time this
 * fires (see CommunityNotificationsService's own comment); this class
 * does no DB writes of its own beyond the one best-effort cleanup on a
 * dead push endpoint.
 *
 * Push routing: a community notification's recipient is always a real
 * `users.id` (you can't reply to/mention someone without being signed
 * in), but push subscriptions live on `web_push_subscriptions`, keyed
 * to `subscribers` (Day 12's bare-identity model, only sometimes linked
 * to a real account via `subscribers.user_id`). A recipient with no
 * linked `subscribers` row, or none configured for push, simply gets no
 * push — their in-app notification (already written) is unaffected.
 */
@Injectable()
export class CommunityPushConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CommunityPushConsumer.name);
  private subscriber?: Redis;

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly webPush: WebPushService,
    private readonly notifications: CommunityNotificationsService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!process.env.DATABASE_URL) {
      this.logger.warn('DATABASE_URL unset — community push consumer not started');
      return;
    }
    this.subscriber = new Redis(bullConnection());
    await this.subscriber.subscribe(COMMUNITY_NOTIFY_CHANNEL);
    this.subscriber.on('message', (channel, message) => {
      if (channel !== COMMUNITY_NOTIFY_CHANNEL) return;
      void this.handle(message);
    });
    this.subscriber.on('error', (err) => {
      this.logger.error(`subscriber connection error: ${err.message}`);
      Sentry.captureException(err, { tags: { component: `${CONSUMER_NAME}-subscriber` } });
    });
    this.logger.log(
      this.webPush.configured
        ? `subscribed to ${COMMUNITY_NOTIFY_CHANNEL}`
        : `subscribed to ${COMMUNITY_NOTIFY_CHANNEL}, but VAPID keys are unset — sends will no-op`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber?.quit();
  }

  private async handle(raw: string): Promise<void> {
    let event: unknown;
    try {
      event = JSON.parse(raw);
    } catch {
      this.logger.error(`malformed ${COMMUNITY_NOTIFY_CHANNEL} payload, not JSON: ${raw.slice(0, 200)}`);
      return;
    }
    if (!isCommunityNotifyEvent(event)) {
      this.logger.error(`malformed ${COMMUNITY_NOTIFY_CHANNEL} payload, missing fields: ${raw.slice(0, 200)}`);
      return;
    }

    try {
      await this.send(event.recipientUserId, event.notificationId, event.type);
    } catch (err) {
      this.logger.error(`push failed for notification ${event.notificationId}: ${(err as Error).message}`);
      Sentry.captureException(err, { tags: { component: CONSUMER_NAME }, extra: { notificationId: event.notificationId } });
    }
  }

  private async send(recipientUserId: string, notificationId: string, type: 'reply' | 'mention'): Promise<void> {
    const targets = await this.db
      .select({ endpoint: webPushSubscriptions.endpoint, p256dh: webPushSubscriptions.p256dh, auth: webPushSubscriptions.auth })
      .from(subscribers)
      .innerJoin(webPushSubscriptions, eq(webPushSubscriptions.subscriberId, subscribers.id))
      .where(eq(subscribers.userId, recipientUserId));

    if (targets.length === 0) return; // no push subscription for this user — the in-app row still exists, nothing more to do

    const notification = await this.notifications.getById(notificationId);
    if (!notification) return; // deleted between publish and consume — nothing to send

    const actor = notification.actorDisplayName ?? 'Someone';
    const payload = {
      title: type === 'reply' ? `${actor} replied to your post` : `${actor} mentioned you`,
      body: notification.preview,
      postId: notification.postId,
      notificationId,
    };

    for (const target of targets) {
      const outcome = await this.webPush.send({ endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } }, payload);
      if (outcome.status === 'gone') {
        await this.db.delete(webPushSubscriptions).where(eq(webPushSubscriptions.endpoint, target.endpoint)).catch(() => undefined);
      } else if (outcome.status === 'error') {
        this.logger.warn(`push send failed for one endpoint: ${outcome.message}`);
      }
    }
  }
}
