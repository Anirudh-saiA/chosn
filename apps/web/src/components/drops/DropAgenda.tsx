'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { DropListItem } from '@/lib/drops';
import { formatDropPrice } from '@/lib/drops';

function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}

function todayIso(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + n);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

/** Drops grouped by day: "week" shows the next 7 days (empty days included), "agenda" lists every day that has a drop, soonest first. */
export function DropAgenda({ drops, mode }: { drops: DropListItem[]; mode: 'week' | 'agenda' }) {
  const days = useMemo(() => {
    const today = todayIso();
    const by = new Map<string, DropListItem[]>();
    for (const d of drops) {
      if (d.releaseDate < today && d.status === 'sold_out') continue;
      by.set(d.releaseDate, [...(by.get(d.releaseDate) ?? []), d]);
    }
    if (mode === 'week') return Array.from({ length: 7 }, (_, i) => addDays(today, i)).map((date) => [date, by.get(date) ?? []] as const);
    return [...by.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [drops, mode]);

  if (days.length === 0) return <p className="panel px-5 py-6 text-body text-text-soft">Nothing is scheduled with these filters.</p>;

  return (
    <ol className="flex flex-col gap-px border border-text/[0.08] bg-text/[0.08] rounded-[20px] overflow-hidden">
      {days.map(([date, list]) => (
        <li key={date} className="grid gap-3 bg-vault-raised p-4 sm:grid-cols-[11rem_1fr]">
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-brass">{dayLabel(date)}</p>
          {list.length === 0 ? (
            <p className="text-meta text-text-faint">No drops</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {list.map((d) => (
                <li key={d.id}>
                  <Link href={`/drops/${d.id}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-body text-text hover:text-brass-bright">
                    <span>
                      {d.sneaker.brand} {d.sneaker.model}
                      {d.sneaker.colorway && d.sneaker.colorway !== 'Default' ? ` ${d.sneaker.colorway}` : ''}
                    </span>
                    <span className="font-mono text-meta text-text-soft">
                      {d.releaseTime ? (d.indiaTime ? d.indiaTime.split(', ').slice(-1)[0] : '') : 'time TBA'} · {formatDropPrice(d)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}
