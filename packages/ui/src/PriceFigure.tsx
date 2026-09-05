import { cx } from './cx';

export interface PriceFigureProps {
  /** Already-formatted price string, e.g. "₹9,499". Formatting is the caller's job. */
  value: string;
  /** Trend percentage. Positive renders Signal, negative renders Rust. Omit for no delta. */
  deltaPct?: number;
  size?: 'hero' | 'inline';
  className?: string;
}

/**
 * The one component every price in the product runs through. Day 2 §02:
 * a price never sets in the body face — always JetBrains Mono, tabular
 * figures. Day 2 §06's fix: `hero` (2.75rem) outsizes display-section
 * (2.25rem) on purpose, so a price reads as more important than the
 * headline sitting next to it.
 */
export function PriceFigure({ value, deltaPct, size = 'inline', className }: PriceFigureProps) {
  const isUp = typeof deltaPct === 'number' && deltaPct > 0;
  const isDown = typeof deltaPct === 'number' && deltaPct < 0;

  return (
    <span className={cx('inline-flex items-baseline gap-2 font-mono tabular-nums', className)}>
      <span
        className={cx(
          'font-medium text-text',
          size === 'hero' ? 'text-data-hero' : 'text-data-inline',
        )}
      >
        {value}
      </span>
      {typeof deltaPct === 'number' && (
        <span
          className={cx(
            'text-data-delta font-semibold',
            isUp && 'text-signal',
            isDown && 'text-rust',
            !isUp && !isDown && 'text-text-soft',
          )}
        >
          {isUp ? '▲' : isDown ? '▼' : '–'} {Math.abs(deltaPct).toFixed(1)}%
        </span>
      )}
    </span>
  );
}
