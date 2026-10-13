'use client';

import { useCallback, useSyncExternalStore } from 'react';

/** What the tray needs to show a shoe without refetching it. */
export interface CompareEntry {
  styleCode: string;
  brand: string;
  model: string;
  colorway: string;
  imageUrl: string | null;
}

export const COMPARE_MAX = 4;
const KEY = 'chosn:compare';
const EVENT = 'chosn:compare-change';
const EMPTY: CompareEntry[] = [];

// useSyncExternalStore needs a stable snapshot: re-parse only when the stored string changes.
let lastRaw: string | null = null;
let lastList: CompareEntry[] = EMPTY;

function read(): CompareEntry[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === lastRaw) return lastList;
    lastRaw = raw;
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    lastList = Array.isArray(parsed) ? (parsed as CompareEntry[]).slice(0, COMPARE_MAX) : EMPTY;
    return lastList;
  } catch {
    return EMPTY; // private mode / blocked storage — the list just won't persist
  }
}

function write(next: CompareEntry[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: nothing to persist to */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onChange); // other tabs
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** The shoes the visitor picked to compare (max four), shared by every toggle and the tray, kept across pages. */
export function useCompareList() {
  const items = useSyncExternalStore(subscribe, read, () => EMPTY);

  const has = useCallback((styleCode: string) => items.some((i) => i.styleCode === styleCode), [items]);
  const remove = useCallback((styleCode: string) => write(read().filter((i) => i.styleCode !== styleCode)), []);
  const clear = useCallback(() => write([]), []);
  const toggle = useCallback((entry: CompareEntry) => {
    const current = read();
    if (current.some((i) => i.styleCode === entry.styleCode)) return write(current.filter((i) => i.styleCode !== entry.styleCode));
    if (current.length >= COMPARE_MAX) return;
    write([...current, entry]);
  }, []);

  return { items, has, toggle, remove, clear, isFull: items.length >= COMPARE_MAX };
}
