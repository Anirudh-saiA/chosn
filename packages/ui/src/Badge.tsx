import type { ReactNode } from 'react';
import { cx } from './cx';

export type BadgeState = 'buy' | 'wait' | 'neutral';

export interface BadgeProps {
  state: BadgeState;
  children: ReactNode;
  className?: string;
}

/**
 * Signal / Rust are reserved for buy / wait meaning. v2 adds a glowing
 * status dot and a tinted fill so the state reads at a glance and never
 * relies on colour alone (the label text carries the meaning).
 */
export function Badge({ state, children, className }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-2 rounded-chip border px-3 py-1 font-mono text-data-delta font-semibold',
        state === 'buy' && 'border-signal/60 bg-signal/10 text-signal shadow-[0_0_16px_-4px_rgba(46,242,166,.55)]',
        state === 'wait' && 'border-rust/60 bg-rust/10 text-rust shadow-[0_0_16px_-4px_rgba(255,79,109,.55)]',
        state === 'neutral' && 'border-text/15 bg-text/[0.04] text-text-soft',
        className,
      )}
    >
      <span
        aria-hidden
        className={cx(
          'h-1.5 w-1.5 rounded-full',
          state === 'buy' && 'bg-signal shadow-[0_0_10px_2px_rgba(46,242,166,.7)]',
          state === 'wait' && 'bg-rust shadow-[0_0_10px_2px_rgba(255,79,109,.7)]',
          state === 'neutral' && 'bg-moss',
        )}
      />
      {children}
    </span>
  );
}
