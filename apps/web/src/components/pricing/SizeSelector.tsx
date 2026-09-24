import { cx } from '@chosn/ui';
import { formatSize, type SiblingSize } from '@/lib/catalog';

export interface SizeSelectorProps {
  sizes: SiblingSize[];
  currentSize: number;
  pendingSize: number | null;
  onSelect: (size: number) => void;
  onPrefetch: (size: number) => void;
}

/** Terminal-style size chips: sharp, mono, 44px targets, brass when selected. */
export function SizeSelector({ sizes, currentSize, pendingSize, onSelect, onPrefetch }: SizeSelectorProps) {
  const system = sizes[0]?.sizeSystem.toUpperCase();
  return (
    <div role="group" aria-label={`Select size${system ? ` (${system})` : ''}`} className="flex flex-wrap gap-2">
      {sizes.map((s) => {
        const active = s.size === currentSize;
        const pending = pendingSize === s.size;
        return (
          <button
            key={s.size}
            type="button"
            aria-pressed={active}
            aria-label={`${s.sizeSystem.toUpperCase()} ${formatSize(s.size)}`}
            aria-current={active ? 'true' : undefined}
            onMouseEnter={() => onPrefetch(s.size)}
            onFocus={() => onPrefetch(s.size)}
            onClick={() => onSelect(s.size)}
            className={cx(
              'relative flex min-h-[44px] min-w-[3.5rem] items-center justify-center border px-3 font-mono text-data-inline tabular-nums transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright',
              active
                ? 'cursor-default border-brass-bright/60 bg-brass-gradient font-semibold text-vault-deep shadow-glow-brass'
                : 'border-text/15 bg-vault-raised/60 text-text hover:-translate-y-px hover:border-brass/60 hover:bg-vault-high',
              pending && !active && 'animate-pulse border-brass/50',
            )}
          >
            {formatSize(s.size)}
          </button>
        );
      })}
      {system && <span className="flex min-h-[44px] items-center px-1 font-mono text-meta uppercase tracking-[0.12em] text-text-faint">{system}</span>}
    </div>
  );
}
