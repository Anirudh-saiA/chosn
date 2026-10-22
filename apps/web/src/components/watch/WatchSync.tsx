'use client';

import { useEffect } from 'react';
import { API_URL, ensureWatchId, getWatchId } from '@/lib/watch';
import { useWishlist } from '@/lib/wishlist';

/** Keeps the server's copy of the wishlist (shoe, size, target price) in step with this device, a moment after each change. */
export function WatchSync() {
  const { items } = useWishlist();
  useEffect(() => {
    if (items.length === 0 && !getWatchId()) return;
    const t = window.setTimeout(async () => {
      const id = await ensureWatchId();
      if (!id) return;
      const body = { items: items.map((i) => ({ styleCode: i.styleCode, size: Number(i.size), targetPrice: i.targetPrice })) };
      void fetch(`${API_URL}/watch/${id}/items`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => undefined);
    }, 800);
    return () => window.clearTimeout(t);
  }, [items]);
  return null;
}
