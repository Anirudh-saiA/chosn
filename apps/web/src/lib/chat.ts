import { wsBaseUrl } from './ws-url';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface ChatRoom {
  id: string;
  dropEventId: string;
  status: 'scheduled' | 'open' | 'archived';
  opensAt: string;
  archivesAt: string | null;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  authorUserId: string;
  authorDisplayName: string | null;
  authorAvatarSeed: string;
  authorReputationScore: number;
  body: string;
  classifierStatus: string;
  createdAt: string;
}

export async function getChatRoomByDrop(dropEventId: string, init?: RequestInit): Promise<ChatRoom | null> {
  const res = await fetch(`${API_URL}/chat/rooms/by-drop/${dropEventId}`, init);
  if (!res.ok) return null;
  return (await res.json()).room ?? null;
}

/** `apiToken`, when present, lets the API filter out a blocked author's messages for this specific viewer (task 7) — omitted for an anonymous reader, who sees everything, same as the feed. */
export async function getChatHistory(roomId: string, apiToken?: string): Promise<ChatMessage[]> {
  const res = await fetch(`${API_URL}/chat/rooms/${roomId}/messages`, {
    cache: 'no-store',
    headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : undefined,
  });
  if (!res.ok) return [];
  return (await res.json()).messages ?? [];
}

export function chatWsUrl(apiToken?: string): string {
  const base = `${wsBaseUrl()}/ws/chat`;
  return apiToken ? `${base}?token=${apiToken}` : base;
}
