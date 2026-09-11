'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  getNotificationPreference,
  listNotifications,
  markAllNotificationsRead,
  setNotificationPreference,
  type CommunityNotification,
} from '@/lib/community-notifications';

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Day 24 task 3 — rendered only on a viewer's own profile (see
 * ProfilePage's own comment on why). Both halves of task 2's brief in
 * one place: the community-specific opt-in/opt-out, and the actual
 * notification inbox it's controlling.
 */
export function NotificationSettings({ apiToken }: { apiToken: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [notifications, setNotifications] = useState<CommunityNotification[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getNotificationPreference(apiToken).then(setEnabled);
    listNotifications(apiToken).then(setNotifications);
  }, [apiToken]);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  async function toggle() {
    if (enabled === null || busy) return;
    setBusy(true);
    const next = !enabled;
    const ok = await setNotificationPreference(apiToken, next);
    if (ok) setEnabled(next);
    setBusy(false);
  }

  async function markRead() {
    const ok = await markAllNotificationsRead(apiToken);
    if (ok) setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
  }

  return (
    <section className="mt-10 border border-moss/20 bg-vault-raised p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-mono text-ui-label font-semibold uppercase tracking-[0.06em] text-text-faint">
          Your notifications
        </h2>
        <label className="flex items-center gap-2 font-mono text-meta text-text-soft">
          <input
            type="checkbox"
            checked={enabled ?? true}
            disabled={enabled === null || busy}
            onChange={toggle}
            className="h-4 w-4 accent-brass"
          />
          Notify me about replies &amp; mentions
        </label>
      </div>
      <p className="mt-1 text-meta text-text-faint">
        Separate from drop alerts (see{' '}
        <Link href="/notifications" className="underline hover:text-text">
          Notification settings
        </Link>
        ) — this only covers activity on your own posts and comments.
      </p>

      {notifications.length === 0 ? (
        <p className="mt-5 text-meta text-text-faint">Nothing yet.</p>
      ) : (
        <>
          <div className="mt-5 flex items-center justify-between">
            <p className="font-mono text-meta text-text-faint">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
            {unreadCount > 0 && (
              <button type="button" onClick={markRead} className="font-mono text-meta text-brass hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <ul className="mt-3 flex flex-col divide-y divide-moss/15">
            {notifications.map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-3 py-3">
                <Link href={`/community/${n.postId}`} className="flex-1 hover:text-brass">
                  <p className="text-body text-text">
                    <span className="font-semibold">{n.actorDisplayName ?? 'Collector'}</span>{' '}
                    {n.type === 'reply' ? 'replied to your post' : 'mentioned you'}
                  </p>
                  <p className="mt-0.5 text-meta text-text-faint">{n.preview}</p>
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  {!n.readAt && <span className="h-2 w-2 rounded-full bg-brass" aria-label="Unread" />}
                  <span className="font-mono text-meta text-text-faint">{timeAgo(n.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
