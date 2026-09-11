const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface CommunityNotification {
  id: string;
  type: 'reply' | 'mention';
  actorUserId: string;
  actorDisplayName: string | null;
  entityType: 'post' | 'comment';
  postId: string;
  preview: string;
  createdAt: string;
  readAt: string | null;
}

function authHeaders(apiToken: string): HeadersInit {
  return { Authorization: `Bearer ${apiToken}` };
}

export async function listNotifications(apiToken: string): Promise<CommunityNotification[]> {
  const res = await fetch(`${API_URL}/community/notifications`, { headers: authHeaders(apiToken), cache: 'no-store' });
  if (!res.ok) return [];
  return (await res.json()).notifications ?? [];
}

export async function getNotificationPreference(apiToken: string): Promise<boolean> {
  const res = await fetch(`${API_URL}/community/notifications/preference`, { headers: authHeaders(apiToken), cache: 'no-store' });
  if (!res.ok) return true;
  return (await res.json()).enabled ?? true;
}

export async function setNotificationPreference(apiToken: string, enabled: boolean): Promise<boolean> {
  const res = await fetch(`${API_URL}/community/notifications/preference`, {
    method: 'PATCH',
    headers: { ...authHeaders(apiToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  return res.ok;
}

export async function markAllNotificationsRead(apiToken: string): Promise<boolean> {
  const res = await fetch(`${API_URL}/community/notifications/mark-read`, { method: 'POST', headers: authHeaders(apiToken) });
  return res.ok;
}
