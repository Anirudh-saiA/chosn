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
  body: string;
  classifierStatus: string;
  createdAt: string;
}

export async function getChatRoomByDrop(dropEventId: string, init?: RequestInit): Promise<ChatRoom | null> {
  const res = await fetch(`${API_URL}/chat/rooms/by-drop/${dropEventId}`, init);
  if (!res.ok) return null;
  return (await res.json()).room ?? null;
}

export async function getChatHistory(roomId: string): Promise<ChatMessage[]> {
  const res = await fetch(`${API_URL}/chat/rooms/${roomId}/messages`, { cache: 'no-store' });
  if (!res.ok) return [];
  return (await res.json()).messages ?? [];
}

export function chatWsUrl(apiToken?: string): string {
  const base = API_URL.replace(/^http/, 'ws') + '/ws/chat';
  return apiToken ? `${base}?token=${apiToken}` : base;
}
