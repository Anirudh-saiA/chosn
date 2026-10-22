'use client';

/**
 * Wishlist alerts, browser side. The wishlist itself stays in localStorage (lib/wishlist.ts); here a random "watch id" is kept next to it
 * and the hearted shoes + sizes + target prices are copied to our API so the nightly job can notice changes and fill the bell inbox.
 * No account is needed; an e-mail is optional and must be confirmed from a link we send.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const ID_KEY = 'chosn:watch:id';

export function getWatchId(): string | null {
  try {
    return window.localStorage.getItem(ID_KEY);
  } catch {
    return null;
  }
}

export async function ensureWatchId(): Promise<string | null> {
  const have = getWatchId();
  if (have) return have;
  try {
    const res = await fetch(`${API_URL}/watch`, { method: 'POST' });
    if (!res.ok) return null;
    const { id } = (await res.json()) as { id: string };
    window.localStorage.setItem(ID_KEY, id);
    return id;
  } catch {
    return null;
  }
}

export interface AlertRow {
  id: string;
  created_at: string;
  style_code: string;
  size: string | null;
  kind: 'back_in_stock' | 'price_drop' | 'target_reached' | 'sold_out';
  message: string;
  unread: boolean;
}

export interface WatchStatus {
  email: string | null;
  confirmed: boolean;
  instant: boolean;
  weekly: boolean;
  unread: number;
}

export async function fetchStatus(id: string): Promise<WatchStatus | null> {
  try {
    const res = await fetch(`${API_URL}/watch/${id}`, { cache: 'no-store' });
    return res.ok ? ((await res.json()) as WatchStatus) : null;
  } catch {
    return null;
  }
}
