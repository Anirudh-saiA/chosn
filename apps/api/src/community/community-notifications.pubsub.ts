/**
 * Day 24 task 2 — same "one publish, many consumers" shape as
 * drop-events.pubsub.ts and moderation-events.pubsub.ts, kept in its
 * own small file for the same reason: `CommunityNotificationsService`
 * (publisher, on comment/post creation) and `CommunityPushConsumer`
 * (consumer, push fan-out) each import only this, not each other's
 * module graph.
 *
 * Deliberately thin: the row already exists in `community_notifications`
 * by the time this publishes (see CommunityNotificationsService's own
 * comment on why the DB write is synchronous, not something the
 * consumer does) — this event only carries what the consumer needs to
 * decide whether/how to push, not a denormalized copy of the
 * notification content.
 */

export const COMMUNITY_NOTIFY_CHANNEL = 'community:notify';

export interface CommunityNotifyEvent {
  notificationId: string;
  recipientUserId: string;
  type: 'reply' | 'mention';
}

export function isCommunityNotifyEvent(value: unknown): value is CommunityNotifyEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as CommunityNotifyEvent).notificationId === 'string' &&
    typeof (value as CommunityNotifyEvent).recipientUserId === 'string' &&
    ((value as CommunityNotifyEvent).type === 'reply' || (value as CommunityNotifyEvent).type === 'mention')
  );
}
