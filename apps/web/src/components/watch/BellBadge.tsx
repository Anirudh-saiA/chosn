'use client';

import { useEffect, useState } from 'react';
import { fetchStatus, getWatchId } from '@/lib/watch';

/** The red count on the bell: unread wishlist alerts. Nothing shows until the shopper has a watch and something new happened. */
export function BellBadge() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = getWatchId();
    if (!id) return;
    void fetchStatus(id).then((s) => s && setN(s.unread));
  }, []);
  if (n <= 0) return null;
  return (
    <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#C8102E] px-1 font-mono text-[0.62rem] font-bold leading-none text-white">
      {n > 9 ? '9+' : n}
    </span>
  );
}
