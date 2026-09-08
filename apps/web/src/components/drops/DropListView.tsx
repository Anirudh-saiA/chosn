import type { DropListItem } from '@/lib/drops';
import { DropCard } from './DropCard';

function formatDateHeading(dateStr: string): string {
  // Parsed as a plain calendar date, not a UTC instant — release_date has
  // no time component of its own, and letting the browser's local
  // timezone reinterpret "2026-09-13" as UTC midnight can roll it back a
  // day for anyone west of Greenwich. `new Date(y, m-1, d)` builds it in
  // local time directly, which is what a plain calendar date means here.
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}

/**
 * Chronological, grouped by date (task 1) — the list view's whole
 * organizing idea. `drops` arrives pre-sorted by release_date/time from
 * the API; this only needs to notice where the date changes.
 */
export function DropListView({ drops }: { drops: DropListItem[] }) {
  if (drops.length === 0) {
    return (
      <p className="py-12 text-center text-body text-text-soft">
        No drops in this range yet — check back soon, or browse every upcoming drop below.
      </p>
    );
  }

  const groups: { date: string; items: DropListItem[] }[] = [];
  for (const drop of drops) {
    const last = groups[groups.length - 1];
    if (last && last.date === drop.releaseDate) last.items.push(drop);
    else groups.push({ date: drop.releaseDate, items: [drop] });
  }

  return (
    <div className="flex flex-col gap-10">
      {groups.map((group) => (
        <section key={group.date}>
          <h2 className="mb-2 font-mono text-ui-label font-semibold uppercase tracking-[0.06em] text-brass">
            {formatDateHeading(group.date)}
          </h2>
          <ul>
            {group.items.map((drop) => (
              <DropCard key={drop.id} drop={drop} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
