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
 *
 * BUGFIX (Day 10): color used to follow the arithmetic sign directly
 * (deltaPct > 0 -> signal green, < 0 -> rust red) — correct for a stock
 * price, backwards for a shopping price, where a fall is the good news.
 * It shipped inverted: HowItWorks.tsx already passes deltaPct={-6.0}
 * next to a green "Buy" Badge, which under the old mapping rendered as
 * a red ▼ beside a green buy signal — a live, contradictory pairing.
 * Fixed so color always matches Badge's buy/wait meaning (a price fall
 * is signal-green, a rise is rust-red); the arrow keeps tracking the
 * literal numeric direction, so ▼ still means "the number went down."
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
            isDown && 'text-signal',
            isUp && 'text-rust',
            !isUp && !isDown && 'text-text-soft',
          )}
        >
          {isUp ? '▲' : isDown ? '▼' : '–'} {Math.abs(deltaPct).toFixed(1)}%
        </span>
      )}
    </span>
  );
}
