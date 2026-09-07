import { cx } from '@chosn/ui';
import { formatSize, type SiblingSize } from '@/lib/catalog';

export interface SizeSelectorProps {
  sizes: SiblingSize[];
  currentSize: number;
  pendingSize: number | null;
  onSelect: (size: number) => void;
  onPrefetch: (size: number) => void;
}

/**
 * `rounded-chip` is Day 2's one sanctioned radius exception (already
 * used by Badge) — reused here rather than introducing a second small
 * radius for "just this one component."
 */
export function SizeSelector({ sizes, currentSize, pendingSize, onSelect, onPrefetch }: SizeSelectorProps) {
  return (
    <div role="group" aria-label="Select size" className="flex flex-wrap gap-2">
      {sizes.map((s) => {
        const active = s.size === currentSize;
        const pending = pendingSize === s.size;
        return (
          <button
            key={s.size}
            type="button"
            aria-pressed={active}
            disabled={active}
            onMouseEnter={() => onPrefetch(s.size)}
            onFocus={() => onPrefetch(s.size)}
            onClick={() => onSelect(s.size)}
            className={cx(
              'min-w-[3rem] rounded-chip border px-3 py-1.5 font-mono text-data-inline tabular-nums transition-colors duration-150 ease-chosn disabled:cursor-default',
              active
                ? 'border-brass bg-brass text-vault'
                : 'border-moss/40 bg-transparent text-text hover:border-moss',
              pending && !active && 'opacity-60',
            )}
          >
            {formatSize(s.size)} {s.sizeSystem.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
