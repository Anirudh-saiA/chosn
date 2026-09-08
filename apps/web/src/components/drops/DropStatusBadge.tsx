'use client';

import { useEffect, useState } from 'react';
import { useDropLiveSocket } from './useDropLiveSocket';

export interface DropStatusBadgeProps {
  dropEventId: string;
  initialStatus: 'upcoming' | 'live' | 'sold_out';
}

/**
 * Flips "Upcoming" -> "Live" the moment DropLiveGateway broadcasts,
 * with no page refresh (task 2). Motion is a single 200ms color/border
 * transition plus a brief highlight fade, not a bounce or a pop-in —
 * "motion shows what changed," it doesn't perform the change. Respects
 * prefers-reduced-motion by dropping the highlight fade entirely; the
 * state change itself (the label swapping) still communicates the
 * update either way.
 */
export function DropStatusBadge({ dropEventId, initialStatus }: DropStatusBadgeProps) {
  const { isLive } = useDropLiveSocket(initialStatus === 'upcoming' ? dropEventId : null);
  const [justFlipped, setJustFlipped] = useState(false);

  const status = isLive ? 'live' : initialStatus;

  useEffect(() => {
    if (!isLive) return;
    setJustFlipped(true);
    const t = setTimeout(() => setJustFlipped(false), 1200);
    return () => clearTimeout(t);
  }, [isLive]);

  const label = status === 'live' ? 'Live now' : status === 'sold_out' ? 'Sold out' : 'Upcoming';

  return (
    <span
      role="status"
      className={
        'inline-flex items-center gap-1.5 rounded-chip border px-3 py-1 font-mono text-data-delta font-semibold transition-colors duration-200 ease-chosn motion-reduce:transition-none ' +
        (status === 'live'
          ? 'border-brass text-brass'
          : status === 'sold_out'
            ? 'border-moss/40 text-text-faint'
            : 'border-moss/40 text-text-soft') +
        (justFlipped ? ' motion-reduce:bg-transparent bg-brass/10' : '')
      }
    >
      <span
        className={
          'h-1.5 w-1.5 rounded-full ' + (status === 'live' ? 'bg-brass' : 'bg-text-faint')
        }
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
