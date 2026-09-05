import { cx } from '@chosn/ui';

const TICKER_ROWS = [
  { sku: 'DD1391-100', price: '₹9,499', deltaPct: 2.1 },
  { sku: 'CT8532-201', price: '₹18,750', deltaPct: -3.4 },
  { sku: 'FZ5897-100', price: '₹12,999', deltaPct: 0.8 },
  { sku: 'HQ1234-002', price: '₹7,200', deltaPct: -1.2 },
  { sku: 'GX9876-500', price: '₹22,400', deltaPct: 5.6 },
] as const;

/**
 * The Day 2 §05 signature motion moment. Pure CSS (see globals.css:
 * .ticker-track, @keyframes ticker-scroll) — no motion library, no
 * client-side JS at all, so it can't block LCP or add to the bundle.
 * Content is doubled for a seamless loop. Hover pauses it; reduced
 * motion freezes it to a static row — both handled in globals.css.
 *
 * Mock data, disclosed as such below the ticker — a price-intelligence
 * product showing fabricated numbers with no indication would be the
 * wrong kind of "premium."
 */
export function PriceTicker() {
  const rows = [...TICKER_ROWS, ...TICKER_ROWS];

  return (
    <div>
      <div className="ticker-shell overflow-hidden border border-moss/25 bg-vault-recessed">
        <div className="ticker-track flex w-max py-4">
          {rows.map((row, i) => {
            const isUp = row.deltaPct > 0;
            return (
              <div
                key={`${row.sku}-${i}`}
                className="flex items-baseline gap-2.5 whitespace-nowrap border-r border-moss/20 px-7 font-mono"
              >
                <span className="text-meta text-text-faint">{row.sku}</span>
                <span className="text-data-inline font-medium text-text">{row.price}</span>
                <span
                  className={cx(
                    'text-data-delta font-semibold',
                    isUp ? 'text-signal' : 'text-rust',
                  )}
                >
                  {isUp ? '▲' : '▼'} {Math.abs(row.deltaPct).toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-meta text-text-faint">
        Sample listings — live tracking arrives in Phase 2.
      </p>
    </div>
  );
}
