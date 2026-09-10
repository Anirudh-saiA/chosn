/**
 * The one contract ReportsService (publisher) and ChatGateway
 * (consumer) agree on — same "one publish, many consumers" shape as
 * drop-events.pubsub.ts, kept in its own small file for the same
 * reason: a consumer imports just this, not the whole publishing
 * service's module graph.
 */

export const MODERATION_RETRACT_CHANNEL = 'moderation:message-retracted';

export interface ModerationRetractEvent {
  roomId: string;
  messageId: string;
}

export function isModerationRetractEvent(value: unknown): value is ModerationRetractEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ModerationRetractEvent).roomId === 'string' &&
    typeof (value as ModerationRetractEvent).messageId === 'string'
  );
}
