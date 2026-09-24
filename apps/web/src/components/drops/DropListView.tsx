import { CalendarX } from 'lucide-react';
import { EmptyPanel } from '@/components/ui/EmptyPanel';
import type { DropListItem } from '@/lib/drops';
import { DropCard } from './DropCard';

/** Chronological grid; each card carries its own date chip. `drops` arrives pre-sorted by release date/time. */
export function DropListView({ drops }: { drops: DropListItem[] }) {
  if (drops.length === 0) {
    return (
      <EmptyPanel icon={<CalendarX className="h-5 w-5" aria-hidden />} title="No drops match">
        Nothing in this range yet. Clear a filter or check back soon.
      </EmptyPanel>
    );
  }

  return (
    <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {drops.map((drop, i) => (
        <DropCard key={drop.id} drop={drop} index={i} />
      ))}
    </ul>
  );
}
