/**
 * The one contract every publisher and consumer in this feature agrees
 * on — the Day 12 design spec's "one publish, many consumers" channel,
 * now with a concrete name and payload shape.
 */

/**
 * Colon-separated, unlike BullMQ queue names (queue.config.ts explains
 * why those use hyphens) — this is a plain Redis Pub/Sub channel, not a
 * BullMQ key, so it has none of BullMQ's ':' restriction, and
 * `namespace:event` is the conventional Redis Pub/Sub channel shape.
 */
export const DROP_LIVE_CHANNEL = 'drop:live';

/**
 * Deliberately minimal — Day 12's spec is explicit that consumers
 * re-read whatever they need from Postgres rather than the event
 * carrying a denormalized copy that can go stale between publish and
 * consume.
 */
export interface DropLiveEvent {
  dropEventId: string;
  sneakerId: string;
  /** When the scheduler observed and flipped this drop, not when a given consumer processes it. */
  timestamp: string;
}

export function isDropLiveEvent(value: unknown): value is DropLiveEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as DropLiveEvent).dropEventId === 'string' &&
    typeof (value as DropLiveEvent).sneakerId === 'string' &&
    typeof (value as DropLiveEvent).timestamp === 'string'
  );
}
