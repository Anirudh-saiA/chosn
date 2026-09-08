'use client';

import { useState } from 'react';
import { requestPushPermission, subscribe, unsubscribe, type SubscriptionScope } from '@/lib/notifications';
import { useSubscriptionsState } from './subscriptions-context';

export interface NotifyToggleProps {
  brand: string;
  styleCode: string;
  modelLabel: string;
}

type PushState = 'idle' | 'prompting' | 'subscribed' | 'denied' | 'unsupported' | 'error';
type ToggleKey = 'model' | 'brand';

/**
 * Two independent toggles — "this model" and "all {brand}" — per Day
 * 12's recommended granularity (brand/model over global). A visitor can
 * turn on either, both, or neither; there's no forced single choice.
 *
 * Push permission is requested contextually, right after the first
 * successful toggle-on in this component's lifetime — never on mount.
 * `Notification.requestPermission()` fired unprompted at page load is
 * a well-documented trust-destroying pattern (task 3's own framing);
 * this only ever fires as a direct consequence of the visitor's own
 * click, and only once (skipped once `Notification.permission` is
 * already 'granted' or 'denied' from an earlier visit).
 */
export function NotifyToggle({ brand, styleCode, modelLabel }: NotifyToggleProps) {
  const { subs, loaded, addLocal, removeLocal } = useSubscriptionsState();
  const [pending, setPending] = useState<ToggleKey | null>(null);
  const [pushState, setPushState] = useState<PushState>('idle');
  const [error, setError] = useState<string | null>(null);

  const isOn = (scopeType: SubscriptionScope, scopeValue: string) =>
    subs.some((s) => s.scopeType === scopeType && s.scopeValue === scopeValue);

  const modelOn = isOn('model', styleCode);
  const brandOn = isOn('brand', brand);

  async function toggle(key: ToggleKey) {
    const scopeType: SubscriptionScope = key === 'model' ? 'model' : 'brand';
    const scopeValue = key === 'model' ? styleCode : brand;
    const currentlyOn = key === 'model' ? modelOn : brandOn;

    setPending(key);
    setError(null);
    try {
      if (currentlyOn) {
        await unsubscribe(scopeType, scopeValue);
        removeLocal(scopeType, scopeValue);
      } else {
        await subscribe(scopeType, scopeValue);
        addLocal({
          id: `local-${scopeType}-${scopeValue}`,
          scopeType,
          scopeValue,
          label: key === 'model' ? modelLabel : brand,
          createdAt: new Date().toISOString(),
        });

        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
          setPushState('prompting');
          const result = await requestPushPermission();
          setPushState(result);
        }
      }
    } catch {
      setError("Couldn't update that — try again in a moment.");
    } finally {
      setPending(null);
    }
  }

  if (!loaded) return null; // avoids a flash of "off" before the real subscription state loads

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <ToggleChip label={`Notify me — ${modelLabel}`} on={modelOn} pending={pending === 'model'} onClick={() => toggle('model')} />
        <ToggleChip label={`Notify me — all ${brand}`} on={brandOn} pending={pending === 'brand'} onClick={() => toggle('brand')} />
      </div>

      {/* Accurate to Day 13's actual DROP_SCHEDULER_INTERVAL_MINUTES default (1) — revisit this copy if that default ever changes. */}
      {(modelOn || brandOn) && (
        <p className="text-meta text-text-faint">
          We check every minute, so expect a notification within about a
          minute of it actually dropping — not to the second.
        </p>
      )}

      {pushState === 'prompting' && (
        <p className="text-meta text-text-faint">Requesting notification permission…</p>
      )}
      {pushState === 'denied' && (
        <p className="text-meta text-text-faint">
          Browser notifications are off — you'll still see it here and in your feed the moment it's live.
        </p>
      )}
      {pushState === 'error' && (
        <p className="text-meta text-text-faint">
          Couldn't set up push notifications on this device — you'll still see it here and in your feed.
        </p>
      )}
      {pushState === 'subscribed' && (
        <p className="text-meta text-text-faint">Push notifications are on for this device.</p>
      )}

      {error && (
        <p role="alert" className="text-data-inline text-rust">
          {error}
        </p>
      )}
    </div>
  );
}

function ToggleChip({
  label,
  on,
  pending,
  onClick,
}: {
  label: string;
  on: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={pending}
      onClick={onClick}
      className={
        'rounded-chip border px-3 py-1.5 font-mono text-data-delta font-semibold transition-colors duration-150 ease-chosn disabled:opacity-60 ' +
        (on ? 'border-brass bg-brass text-vault' : 'border-moss text-text-soft hover:border-text')
      }
    >
      {pending ? 'Updating…' : on ? `✓ ${label}` : label}
    </button>
  );
}
