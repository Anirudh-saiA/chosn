'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BellOff, Building2, Globe, Loader2, Tag, Trash2, type LucideIcon } from 'lucide-react';
import { getStoredSubscriberId, listSubscriptions, unsubscribe, type SubscriptionListItem } from '@/lib/notifications';

const SCOPE: Record<SubscriptionListItem['scopeType'], { label: string; icon: LucideIcon }> = {
  model: { label: 'Model', icon: Tag },
  brand: { label: 'Brand', icon: Building2 },
  global: { label: 'Everything', icon: Globe },
};

/**
 * The settings-page half of task 4: every active subscription, one
 * unsubscribe button each, no confirmation dialog in the way — the
 * brief is explicit that unsubscribing shouldn't be harder to find than
 * subscribing, and an extra "are you sure?" step is exactly that kind
 * of friction for an action with a cheap, obvious undo (subscribe
 * again from the sneaker/brand page). Same data calls as drops'
 * SubscriptionList, restyled for the Noir Terminal notifications page.
 */
export function SubscriptionPanel() {
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
      <div className="flex flex-col gap-3" role="status" aria-label="Loading subscriptions">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!getStoredSubscriberId() || subs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center border border-brass/30 bg-brass/[0.07] text-brass-bright">
          <BellOff className="h-6 w-6" aria-hidden />
        </span>
        <p className="font-display text-xl font-semibold text-text">No active alerts</p>
        <p className="max-w-sm text-text-soft">
          Turn on &ldquo;Notify me&rdquo; on any sneaker or brand page to start getting drop alerts.
        </p>
        <Link href="/sneakers" className="font-mono text-meta font-semibold text-brass-bright underline underline-offset-4">
          Browse sneakers
        </Link>
      </div>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-text/[0.08]">
      {subs.map((item) => {
        const { label, icon: Icon } = SCOPE[item.scopeType];
        const removing = removingId === item.id;
        return (
          <li key={item.id} className="flex items-center justify-between gap-4 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-text/15 text-brass">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-text-soft">{label}</p>
                <p className="truncate text-body font-semibold text-text">{item.label}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleRemove(item)}
              disabled={removing}
              aria-label={`Unsubscribe from ${item.label}`}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 border border-text/15 px-3.5 font-sans text-ui-label font-semibold text-text-soft transition-colors hover:border-rust/60 hover:bg-rust/[0.07] hover:text-rust disabled:opacity-60"
            >
              {removing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
              <span className="hidden sm:inline">{removing ? 'Removing…' : 'Unsubscribe'}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
