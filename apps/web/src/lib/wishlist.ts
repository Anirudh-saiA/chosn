'use client';

import { useSyncExternalStore } from 'react';

/** What we keep per saved sneaker - enough to render a card without calling the API. */
export interface WishlistItem {
  styleCode: string;
  size: string;
  brand: string;
  model: string;
  colorway: string;
  imageUrl: string | null;
  price: number | null;
  savedAt: number;
}

const KEY = 'chosn:wishlist:v1';
const EMPTY: WishlistItem[] = [];
const listeners = new Set<() => void>();
let cache: WishlistItem[] | null = null;

function read(): WishlistItem[] {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed) ? (parsed as WishlistItem[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(next: WishlistItem[]) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage blocked: the list still works for this tab
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null; // another tab changed the list
      cb();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
}

/** Reactive wishlist; empty on the server and during hydration so markup always matches. */
export function useWishlist() {
  const items = useSyncExternalStore(subscribe, read, () => EMPTY);
  const has = (styleCode: string) => items.some((i) => i.styleCode === styleCode);
  const toggle = (item: Omit<WishlistItem, 'savedAt'>) =>
    write(has(item.styleCode) ? items.filter((i) => i.styleCode !== item.styleCode) : [{ ...item, savedAt: Date.now() }, ...items]);
  const remove = (styleCode: string) => write(items.filter((i) => i.styleCode !== styleCode));
  return { items, has, toggle, remove };
}
