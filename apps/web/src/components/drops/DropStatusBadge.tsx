'use client';

import { useEffect, useState } from 'react';
import { useIsDropLive } from './drop-live-context';

export interface DropStatusBadgeProps {
  dropEventId: string;
  initialStatus: 'upcoming' | 'live' | 'sold_out';
  className?: string;
}

/**
 * Flips "Upcoming" -> "Live now" the moment DropLiveGateway broadcasts,
 * with no page refresh. Motion is a single colour transition plus a brief
 * highlight fade; reduced-motion users skip the highlight (the label swap
 * still communicates the change).
 *
 * `useIsDropLive` reads a page-shared WebSocket when a `DropLiveProvider`
 * is present and transparently falls back to its own connection otherwise.
 */
export function DropStatusBadge({ dropEventId, initialStatus, className = '' }: DropStatusBadgeProps) {
  const isLive = useIsDropLive(initialStatus === 'upcoming' ? dropEventId : null);
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
        'inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[0.65rem] font-semibold uppercase tracking-wider transition-colors duration-200 ease-chosn motion-reduce:transition-none ' +
        (status === 'live'
          ? 'border-signal/50 bg-signal/10 text-signal'
          : status === 'sold_out'
            ? 'border-text/15 bg-vault-deep/70 text-text-faint'
            : 'border-brass/50 bg-brass/10 text-brass-bright') +
        (justFlipped ? ' motion-reduce:bg-transparent shadow-glow-signal' : '') +
        (className ? ` ${className}` : '')
      }
    >
      {status === 'live' ? (
        <span className="live-dot !h-1.5 !w-1.5 text-signal" aria-hidden="true" />
      ) : (
        <span className={'h-1.5 w-1.5 rounded-full ' + (status === 'sold_out' ? 'bg-text-faint' : 'bg-brass')} aria-hidden="true" />
      )}
      {label}
    </span>
  );
}
