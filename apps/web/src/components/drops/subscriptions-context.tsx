'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { listSubscriptions, type SubscriptionListItem, type SubscriptionScope } from '@/lib/notifications';

interface SubscriptionsState {
  subs: SubscriptionListItem[];
  loaded: boolean;
  addLocal: (item: SubscriptionListItem) => void;
  removeLocal: (scopeType: SubscriptionScope, scopeValue: string) => void;
}

const SubscriptionsContext = createContext<SubscriptionsState | null>(null);

/**
 * One `listSubscriptions()` call shared by every `NotifyToggle` on the
 * page, instead of one per instance. Real Lighthouse regression caught
 * this: the drop calendar list renders several `NotifyToggle`s at
 * once, each independently fetching the same endpoint on mount — five
 * drops meant five simultaneous, identical requests, and Total Blocking
 * Time/LCP both took a real hit (76 performance, see drops/README.md's
 * Day 15 section for the actual before/after numbers). This provider
 * fetches once; every `NotifyToggle` under it reads the same state and
 * applies its own optimistic add/remove locally.
 */
export function SubscriptionsProvider({ children }: { children: ReactNode }) {
  const [subs, setSubs] = useState<SubscriptionListItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listSubscriptions().then((result) => {
      if (!cancelled) {
        setSubs(result);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const addLocal = useCallback((item: SubscriptionListItem) => setSubs((prev) => [...prev, item]), []);
  const removeLocal = useCallback(
    (scopeType: SubscriptionScope, scopeValue: string) =>
      setSubs((prev) => prev.filter((s) => !(s.scopeType === scopeType && s.scopeValue === scopeValue))),
    [],
  );

  return (
    <SubscriptionsContext.Provider value={{ subs, loaded, addLocal, removeLocal }}>
      {children}
    </SubscriptionsContext.Provider>
  );
}

/**
 * Reads the shared list under `SubscriptionsProvider`; falls back to
 * its own single fetch when there's no provider ancestor (the sneaker
 * page and the drop-detail page each render exactly one `NotifyToggle`,
 * so there's nothing to share there — same opt-in shape as
 * `useIsDropLive`/`DropLiveProvider`).
 */
export function useSubscriptionsState(): SubscriptionsState {
  const shared = useContext(SubscriptionsContext);
  const [localSubs, setLocalSubs] = useState<SubscriptionListItem[]>([]);
  const [localLoaded, setLocalLoaded] = useState(false);

  useEffect(() => {
    if (shared) return; // a provider ancestor already owns this fetch
    let cancelled = false;
    listSubscriptions().then((result) => {
      if (!cancelled) {
        setLocalSubs(result);
        setLocalLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [shared]);

  if (shared) return shared;

  return {
    subs: localSubs,
    loaded: localLoaded,
    addLocal: (item) => setLocalSubs((prev) => [...prev, item]),
    removeLocal: (scopeType, scopeValue) =>
      setLocalSubs((prev) => prev.filter((s) => !(s.scopeType === scopeType && s.scopeValue === scopeValue))),
  };
}
