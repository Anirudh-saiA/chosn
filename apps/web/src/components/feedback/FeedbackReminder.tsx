'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { duePurchase, forgetPurchase, type PendingPurchase } from '@/lib/purchases';

/** A small note, shown a few days after a Buy click on this device: "Did it arrive?" Dismissing it forgets the click. */
export function FeedbackReminder() {
  const [p, setP] = useState<PendingPurchase | null>(null);
  useEffect(() => setP(duePurchase()), []);
  if (!p) return null;
  const q = new URLSearchParams({ shoe: p.styleCode, store: p.store, name: p.storeName, title: p.shoeName });
  if (p.size) q.set('size', String(p.size));
  if (p.promisedMaxDays !== null) q.set('promised', String(p.promisedMaxDays));
  return (
    <div role="status" className="fixed bottom-4 left-4 z-50 max-w-xs rounded-2xl border border-text/15 bg-white p-4 shadow-lg">
      <p className="text-sm font-bold text-text">Did your {p.shoeName} arrive?</p>
      <p className="mt-1 text-xs text-text-muted">You clicked through to {p.storeName}. Two quick questions help other shoppers.</p>
      <div className="mt-3 flex items-center gap-3">
        <Link href={`/how-did-it-go?${q}`} className="rounded-full bg-[#0A0A0A] px-4 py-2 text-xs font-bold text-white">Answer</Link>
        <button type="button" onClick={() => { forgetPurchase(p.styleCode, p.store); setP(null); }} className="text-xs font-semibold text-text-muted underline">No thanks</button>
      </div>
    </div>
  );
}
