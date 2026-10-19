'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { API_URL, ensureWatchId, fetchStatus, getWatchId, type AlertRow, type WatchStatus } from '@/lib/watch';

const KIND: Record<AlertRow['kind'], string> = {
  back_in_stock: 'Back in stock',
  price_drop: 'Price drop',
  target_reached: 'Target reached',
  sold_out: 'Sold out',
};

/** The bell inbox: what the nightly check found for the shoes on your wishlist, plus the optional e-mail for the same alerts. */
export function AlertsInbox({ flash }: { flash?: string }) {
  const [alerts, setAlerts] = useState<AlertRow[] | null>(null);
  const [status, setStatus] = useState<WatchStatus | null>(null);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');

  async function load() {
    const id = getWatchId();
    if (!id) return setAlerts([]);
    const [a, s] = await Promise.all([
      fetch(`${API_URL}/watch/${id}/alerts`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : { alerts: [] }))
        .catch(() => ({ alerts: [] })),
      fetchStatus(id),
    ]);
    setAlerts(a.alerts);
    setStatus(s);
    if (s && s.unread > 0) void fetch(`${API_URL}/watch/${id}/alerts/read`, { method: 'POST' }).catch(() => undefined);
  }
  useEffect(() => {
    void load();
  }, []);

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    const id = await ensureWatchId();
    if (!id) return setMsg('Could not reach the server. Try again in a moment.');
    const res = await fetch(`${API_URL}/watch/${id}/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    setMsg(res?.ok ? 'Check your inbox and tap the confirm link. Until you do, nothing is sent.' : 'That did not work. Check the address and try again.');
    if (res?.ok) void load();
  }

  async function pref(patch: { instant?: boolean; weekly?: boolean }) {
    const id = getWatchId();
    if (!id) return;
    await fetch(`${API_URL}/watch/${id}/prefs`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }).catch(() => undefined);
    void load();
  }

  return (
    <section className="panel p-5 sm:p-6" aria-labelledby="inbox-h">
      <h2 id="inbox-h" className="font-display text-xl font-bold text-text">
        Your wishlist alerts
      </h2>
      <p className="mb-4 mt-1 text-meta text-text-soft">
        We check the shoes and sizes you saved after every nightly price update, and tell you here (and by e-mail, if you add one) when a size is back, a price drops, or your target is reached.
      </p>
      {flash === 'confirmed' ? <p role="status" className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">E-mail confirmed. You will get wishlist alerts.</p> : null}
      {flash === 'unsubscribed' ? <p role="status" className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">You are unsubscribed from wishlist e-mails. Alerts still appear here.</p> : null}

      {alerts === null ? (
        <p className="text-sm text-text-soft">Loading…</p>
      ) : alerts.length === 0 ? (
        <p className="text-sm text-text-soft">
          Nothing new yet. Tap the heart on a sneaker in your size and we will watch it.{' '}
          <Link href="/wishlist" className="font-semibold underline">
            Open wishlist
          </Link>
        </p>
      ) : (
        <ul className="divide-y divide-text/10">
          {alerts.map((a) => (
            <li key={a.id} className="py-3">
              <Link href={`/sneakers/${encodeURIComponent(a.style_code)}/${a.size ?? ''}`} className="block">
                <span className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.16em] text-brass">{KIND[a.kind]}</span>
                <span className="mt-0.5 block text-sm font-semibold text-text">{a.message}</span>
                <span className="mt-0.5 block text-xs text-text-soft">{new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 border-t border-text/10 pt-5">
        <h3 className="text-sm font-bold text-text">E-mail me too</h3>
        {status?.email ? (
          <div className="mt-2 space-y-2 text-sm text-text">
            <p>
              {status.email} {status.confirmed ? '(confirmed)' : '(waiting for you to confirm from the mail we sent)'}
            </p>
            {status.confirmed ? (
              <>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={status.instant} onChange={(e) => pref({ instant: e.target.checked })} /> Mail me as soon as something changes
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={status.weekly} onChange={(e) => pref({ weekly: e.target.checked })} /> Weekly summary of my wishlist, even when nothing changed
                </label>
              </>
            ) : null}
          </div>
        ) : (
          <form onSubmit={saveEmail} className="mt-2 flex flex-wrap gap-2">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="min-w-[14rem] flex-1 rounded-lg border border-text/20 px-3 py-2 text-sm" aria-label="E-mail address" />
            <button type="submit" className="rounded-full bg-[#14213D] px-5 py-2 text-sm font-bold text-white">
              Send confirmation
            </button>
          </form>
        )}
        {msg ? <p role="status" className="mt-2 text-sm text-text-soft">{msg}</p> : null}
        <p className="mt-3 text-xs text-text-soft">WhatsApp alerts are planned. Every mail has an unsubscribe link, and your address is used for these alerts only.</p>
      </div>
    </section>
  );
}
