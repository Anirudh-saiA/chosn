'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BellRing, CheckCheck, Inbox } from 'lucide-react';
import {
  getNotificationPreference,
  listNotifications,
  markAllNotificationsRead,
  setNotificationPreference,
  type CommunityNotification,
} from '@/lib/community-notifications';
import { timeAgo } from './meta';
import { Switch } from './Switch';

/**
 * Day 24 task 3 — both halves of task 2's brief in one place: the
 * community-specific opt-in/opt-out, and the actual notification inbox
 * it's controlling. Rendered on a viewer's own profile and on
 * /notifications.
 */
export function NotificationSettings({ apiToken, heading = true, className = 'mt-10' }: { apiToken: string; heading?: boolean; className?: string }) {
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
    <section className={`panel p-5 sm:p-6 ${className}`} aria-labelledby="community-notif-h">
      {heading && (
        <h2 id="community-notif-h" className="mb-5 flex items-center gap-2 font-display text-xl font-bold text-text">
          <BellRing className="h-5 w-5 text-brass" aria-hidden /> Your notifications
        </h2>
      )}
      <Switch
        id="community-notif-switch"
        checked={enabled ?? true}
        disabled={enabled === null || busy}
        onChange={toggle}
        label="Replies & mentions"
        description="Get notified when someone replies to your post or mentions you. Separate from drop alerts — this only covers activity on your own posts and comments."
      />
      {!heading && <span id="community-notif-h" className="sr-only">Your notifications</span>}

      <div className="mt-6 border-t border-text/[0.08] pt-5">
        {notifications.length === 0 ? (
          <p className="flex items-center gap-2 font-mono text-meta text-text-soft">
            <Inbox className="h-4 w-4" aria-hidden /> Nothing yet — replies and mentions will land here.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-meta text-text-soft">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </p>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markRead}
                  className="inline-flex min-h-11 items-center gap-1.5 font-mono text-meta font-semibold text-brass-bright hover:underline"
                >
                  <CheckCheck className="h-4 w-4" aria-hidden /> Mark all read
                </button>
              )}
            </div>
            <ul className="mt-2 flex flex-col divide-y divide-text/[0.08]">
              {notifications.map((n) => (
                <li key={n.id}>
                  <Link
                    href={`/community/${n.postId}`}
                    className="group flex items-start justify-between gap-3 py-3.5 transition-colors"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-body text-text group-hover:text-brass-bright">
                        <span className="font-semibold">{n.actorDisplayName ?? 'Collector'}</span>{' '}
                        {n.type === 'reply' ? 'replied to your post' : 'mentioned you'}
                      </span>
                      <span className="mt-0.5 block truncate text-meta text-text-soft">{n.preview}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {!n.readAt && (
                        <>
                          <span className="h-2 w-2 rounded-full bg-brass-bright" aria-hidden />
                          <span className="sr-only">Unread</span>
                        </>
                      )}
                      <span className="font-mono text-meta text-text-soft">{timeAgo(n.createdAt)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
        {heading && (
          <p className="mt-4 text-meta text-text-soft">
            Drop &amp; brand alerts live in{' '}
            <Link href="/notifications" className="text-brass-bright underline underline-offset-4">
              notification settings
            </Link>
            .
          </p>
        )}
      </div>
    </section>
  );
}
