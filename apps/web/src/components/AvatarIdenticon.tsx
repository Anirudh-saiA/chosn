import { identiconPattern } from '@/lib/avatar';

interface AvatarIdenticonProps {
  seed: string;
  size?: number;
  className?: string;
}

/**
 * Renders `lib/avatar.ts`'s pattern as inline SVG — a plain Server
 * Component (no 'use client'), since the pattern is pure/synchronous
 * and needs no browser API. Works identically wherever it's dropped in:
 * the account settings page, a future report/moderation row showing
 * who filed something, a future profile card.
 */
export function AvatarIdenticon({ seed, size = 40, className }: AvatarIdenticonProps) {
  const { cells, hue } = identiconPattern(seed);
  const cellSize = 100 / cells.length;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Account avatar"
    >
      <rect width={100} height={100} fill={`hsl(${hue} 30% 92%)`} />
      {cells.map((row, r) =>
        row.map(
          (filled, c) =>
            filled && (
              <rect
                key={`${r}-${c}`}
                x={c * cellSize}
                y={r * cellSize}
                width={cellSize}
                height={cellSize}
                fill={`hsl(${hue} 55% 45%)`}
              />
            ),
        ),
      )}
    </svg>
  );
}
