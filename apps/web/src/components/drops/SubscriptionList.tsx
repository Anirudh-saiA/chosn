'use client';

import { useEffect, useState } from 'react';
import { BellOff, BellRing, Trash2 } from 'lucide-react';
import { EmptyPanel } from '@/components/ui/EmptyPanel';
import { getStoredSubscriberId, listSubscriptions, unsubscribe, type SubscriptionListItem } from '@/lib/notifications';

const SCOPE_LABEL: Record<SubscriptionListItem['scopeType'], string> = {
  model: 'Model',
  brand: 'Brand',
  global: 'Everything',
};

/**
 * The settings-page half of task 4: every active subscription, one
 * unsubscribe button each, no confirmation dialog in the way — unsubscribing
 * shouldn't be harder to find than subscribing, and the action has a cheap,
 * obvious undo (subscribe again from the sneaker/brand page).
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
    return (
      <div className="flex flex-col gap-3" role="status" aria-label="Loading notifications">
        <div className="skeleton h-16 w-full" aria-hidden />
        <div className="skeleton h-16 w-full" aria-hidden />
      </div>
    );
  }

  if (!getStoredSubscriberId() || subs.length === 0) {
    return (
      <EmptyPanel icon={<BellOff className="h-5 w-5" aria-hidden />} title="No active notifications yet">
        Turn on "Notify me" on any sneaker or brand page to start getting drop alerts.
      </EmptyPanel>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {subs.map((item) => (
        <li key={item.id} className="panel flex items-center justify-between gap-4 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-brass/30 bg-brass/[0.07] text-brass-bright">
              <BellRing className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-brass">{SCOPE_LABEL[item.scopeType]}</p>
              <p className="truncate font-display text-lg font-semibold text-text">{item.label}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleRemove(item)}
            disabled={removingId === item.id}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 border border-text/[0.15] px-3 font-mono text-data-delta font-semibold text-text-soft transition-colors duration-200 hover:border-rust/60 hover:text-rust focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            {removingId === item.id ? 'Removing…' : 'Unsubscribe'}
          </button>
        </li>
      ))}
    </ul>
  );
}
