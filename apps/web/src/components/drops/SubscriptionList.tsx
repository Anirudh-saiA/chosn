'use client';

import { useEffect, useState } from 'react';
import { getStoredSubscriberId, listSubscriptions, unsubscribe, type SubscriptionListItem } from '@/lib/notifications';

const SCOPE_LABEL: Record<SubscriptionListItem['scopeType'], string> = {
  model: 'Model',
  brand: 'Brand',
  global: 'Everything',
};

/**
 * The settings-page half of task 4: every active subscription, one
 * unsubscribe button each, no confirmation dialog in the way — the
 * brief is explicit that unsubscribing shouldn't be harder to find than
 * subscribing, and an extra "are you sure?" step is exactly that kind
 * of friction for an action with a cheap, obvious undo (subscribe
 * again from the sneaker/brand page).
 */
export function SubscriptionList() {
  const [subs, setSubs] = useState<SubscriptionListItem[] | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    listSubscriptions().then(setSubs);
  }, []);

  async function handleRemove(item: SubscriptionListItem) {
    setRemovingId(item.id);
    try {
      await unsubscribe(item.scopeType, item.scopeValue);
      setSubs((prev) => prev?.filter((s) => s.id !== item.id) ?? null);
    } finally {
      setRemovingId(null);
    }
  }

  if (subs === null) {
    return <p className="text-body text-text-soft">Loading…</p>;
  }

  if (!getStoredSubscriberId() || subs.length === 0) {
    return (
      <p className="text-body text-text-soft">
        No active notifications yet. Turn on "Notify me" on any sneaker
        or brand page to start getting drop alerts.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-moss/15 border-y border-moss/15">
      {subs.map((item) => (
        <li key={item.id} className="flex items-center justify-between gap-4 py-4">
          <div>
            <p className="font-mono text-meta uppercase tracking-[0.06em] text-text-faint">
              {SCOPE_LABEL[item.scopeType]}
            </p>
            <p className="text-body text-text">{item.label}</p>
          </div>
          <button
            type="button"
            onClick={() => handleRemove(item)}
            disabled={removingId === item.id}
            className="font-mono text-data-inline font-semibold text-text-soft underline decoration-moss/40 underline-offset-4 transition-colors duration-150 ease-chosn hover:text-rust disabled:opacity-60"
          >
            {removingId === item.id ? 'Removing…' : 'Unsubscribe'}
          </button>
        </li>
      ))}
    </ul>
  );
}
