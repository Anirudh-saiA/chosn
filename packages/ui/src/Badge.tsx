import type { ReactNode } from 'react';
import { cx } from './cx';

export type BadgeState = 'buy' | 'wait' | 'neutral';

export interface BadgeProps {
  state: BadgeState;
  children: ReactNode;
  className?: string;
}

/** Day 2 §01 — the only two places Signal and Rust are allowed to appear. */
export function Badge({ state, children, className }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-chip border px-3 py-1 font-mono text-data-delta font-semibold',
        state === 'buy' && 'border-signal text-signal',
        state === 'wait' && 'border-rust text-rust',
        state === 'neutral' && 'border-moss/40 text-text-soft',
        className,
      )}
    >
      {children}
    </span>
  );
}
