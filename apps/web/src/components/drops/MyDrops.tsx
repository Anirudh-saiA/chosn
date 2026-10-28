'use client';

import { useEffect, useState } from 'react';
import { CalendarPlus, Copy } from 'lucide-react';
import { API_URL, getWatchId } from '@/lib/watch';
import type { DropListItem } from '@/lib/drops';
import { DropCard } from './DropCard';

interface Mine {
  follows: Array<{ kind: string; ref: string; size: number | null }>;
  drops: DropListItem[];
}

/** The drops and brands one shopper follows, plus a personal calendar link that keeps itself up to date. */
export function MyDrops() {
  const [mine, setMine] = useState<Mine | null>(null);
  const [state, setState] = useState<'loading' | 'none' | 'ready'>('loading');
  const [copied, setCopied] = useState(false);
  const [watch, setWatch] = useState<string | null>(null);

  useEffect(() => {
    const id = getWatchId();
    setWatch(id);
    if (!id) {
      setState('none');
      return;
    }
    void fetch(`${API_URL}/watch/${id}/drops`, { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<Mine>) : null))
      .then((m) => {
        setMine(m);
        setState(m ? 'ready' : 'none');
      })
      .catch(() => setState('none'));
  }, []);

  const feed = watch ? `${API_URL}/drops/my.ics?watch=${watch}` : '';

  async function copy() {
    try {
      await navigator.clipboard.writeText(feed);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the link is also shown in the box below */
    }
  }

  if (state === 'loading') return <p className="text-meta text-text-soft">Loading your drops...</p>;
  const brands = (mine?.follows ?? []).filter((f) => f.kind === 'brand' || f.kind === 'collab');
  const upcoming = (mine?.drops ?? []).filter((d) => d.status !== 'sold_out');
  const past = (mine?.drops ?? []).filter((d) => d.status === 'sold_out');

  return (
    <div className="flex flex-col gap-8">
      {state === 'none' || !mine || (mine.drops.length === 0 && brands.length === 0) ? (
        <p className="panel px-5 py-6 text-body text-text-soft">
          You aren&apos;t following anything yet. Open any drop and tap <strong className="text-text">Follow</strong> or <strong className="text-text">Notify me</strong>; it will show up here.
        </p>
      ) : null}

      {brands.length > 0 && (
        <section aria-labelledby="mine-brands">
          <h2 id="mine-brands" className="mb-3 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-brass">Brands and collabs you follow</h2>
          <ul className="flex flex-wrap gap-2">
            {brands.map((b) => (
              <li key={`${b.kind}:${b.ref}`} className="border border-text/[0.15] px-3 py-1.5 font-mono text-meta text-text rounded-[20px]">{b.ref}</li>
            ))}
          </ul>
        </section>
      )}

      {upcoming.length > 0 && (
        <section aria-labelledby="mine-upcoming">
          <h2 id="mine-upcoming" className="mb-3 font-display text-2xl font-bold text-text">Coming up</h2>
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {upcoming.map((d, i) => (
              <DropCard key={d.id} drop={d} index={i} />
            ))}
          </ul>
        </section>
      )}

      {past.length > 0 && (
        <section aria-labelledby="mine-past">
          <h2 id="mine-past" className="mb-3 font-display text-2xl font-bold text-text">Released</h2>
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {past.map((d, i) => (
              <DropCard key={d.id} drop={d} index={i} />
            ))}
          </ul>
        </section>
      )}

      {watch && (
        <section aria-labelledby="mine-cal" className="panel flex flex-col gap-3 p-5">
          <h2 id="mine-cal" className="flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-brass">
            <CalendarPlus className="h-3.5 w-3.5" aria-hidden /> Your personal calendar
          </h2>
          <p className="text-meta text-text-soft">
            Subscribe to this link in Google Calendar (Other calendars, From URL), Apple Calendar or Outlook. It lists the drops you follow and updates itself when dates change. Keep the link private: it is tied to you.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input readOnly value={feed} aria-label="Personal calendar link" className="min-h-[44px] min-w-0 flex-1 border border-text/[0.15] bg-vault-deep px-3 font-mono text-meta text-text rounded-[20px]" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" onClick={copy} className="inline-flex min-h-[44px] items-center gap-1.5 border border-text/[0.15] px-3 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-text hover:border-brass rounded-full">
              <Copy className="h-3.5 w-3.5" aria-hidden /> {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
