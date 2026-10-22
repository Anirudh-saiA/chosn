'use client';

import { useMemo, useState } from 'react';
import { CalendarX } from 'lucide-react';
import { EmptyPanel } from '@/components/ui/EmptyPanel';
import type { DropListItem } from '@/lib/drops';
import { DropCard } from './DropCard';

const PAGE = 24;

/**
 * Chronological grid; each card carries its own date chip. Live and upcoming drops come first, soonest first; releases that are
 * already out come after, most recent first. Shows 24 at a time so a long calendar stays quick.
 */
export function DropListView({ drops }: { drops: DropListItem[] }) {
  const [shown, setShown] = useState(PAGE);
  const sorted = useMemo(() => {
    const key = (d: DropListItem) => `${d.releaseDate} ${d.releaseTime ?? '99:99'}`;
    const ahead = drops.filter((d) => d.status !== 'sold_out').sort((a, b) => key(a).localeCompare(key(b)));
    const past = drops.filter((d) => d.status === 'sold_out').sort((a, b) => key(b).localeCompare(key(a)));
    return [...ahead, ...past];
  }, [drops]);

  if (drops.length === 0) {
    return (
      <EmptyPanel icon={<CalendarX className="h-5 w-5" aria-hidden />} title="No drops match">
        Nothing in this range yet. Clear a filter or check back soon.
      </EmptyPanel>
    );
  }

  return (
    <>
      <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {sorted.slice(0, shown).map((drop, i) => (
          <DropCard key={drop.id} drop={drop} index={i} />
        ))}
      </ul>
      {shown < sorted.length ? (
        <div className="mt-8 flex justify-center">
          <button type="button" onClick={() => setShown((n) => n + PAGE)} className="rounded-full border border-[#14213D] bg-white px-7 py-3 font-display text-lg uppercase tracking-[0.06em] text-[#14213D] hover:bg-[#EAF3FA]">
            Show more ({sorted.length - shown} left)
          </button>
        </div>
      ) : null}
    </>
  );
}
