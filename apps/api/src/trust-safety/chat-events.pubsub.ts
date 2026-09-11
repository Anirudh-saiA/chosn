/**
 * Day 26 — the "more than one Railway instance" fix for chat. Room
 * membership (`roomMembers` in chat.gateway.ts) is necessarily
 * per-instance in-memory state (it's which sockets *this process* holds
 * open), but the *decision* to broadcast can't stay per-instance once
 * there's more than one — a message sent by a client connected to
 * instance A must also reach a client connected to instance B. Same
 * "one publish, many consumers" shape as drop-events.pubsub.ts /
 * moderation-events.pubsub.ts: every instance (including the one that
 * published) subscribes and does its own local `broadcastToRoom` in
 * response, so the local-delivery code path is unchanged — only its
 * trigger moves from "call directly" to "react to this channel."
 */

export const CHAT_BROADCAST_CHANNEL = 'chat:broadcast';

export interface ChatBroadcastEvent {
  roomId: string;
  /** Opaque to this contract — whatever frame chat.gateway.ts's client protocol sends (chat:message, chat:retract, …). */
  payload: unknown;
  /** userIds to skip on delivery — task 7's block enforcement, carried through the pub/sub hop unchanged. */
  excludedRecipients: string[];
}

export function isChatBroadcastEvent(value: unknown): value is ChatBroadcastEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ChatBroadcastEvent).roomId === 'string' &&
    Array.isArray((value as ChatBroadcastEvent).excludedRecipients)
  );
}
