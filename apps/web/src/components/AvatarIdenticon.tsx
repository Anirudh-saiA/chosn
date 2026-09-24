import { identiconPattern } from '@/lib/avatar';

interface AvatarIdenticonProps {
  seed: string;
  size?: number;
  className?: string;
  /** Wraps the identicon in a round brass-gradient ring (profile hero, thread header). */
  ring?: boolean;
}

/**
 * Renders `lib/avatar.ts`'s pattern as inline SVG — a plain Server
 * Component (no 'use client'), since the pattern is pure/synchronous
 * and needs no browser API. Dark-vault tinted so it sits naturally on
 * the Noir Terminal surfaces: a deep hue-tinted tile with a bright glyph.
 */
export function AvatarIdenticon({ seed, size = 40, className, ring = false }: AvatarIdenticonProps) {
  const { cells, hue } = identiconPattern(seed);
  const cellSize = 100 / cells.length;
  const id = `av-${seed.replace(/[^a-z0-9]/gi, '')}`;

  const svg = (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={ring ? 'block' : className}
      role="img"
      aria-label="Account avatar"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`hsl(${hue} 34% 20%)`} />
          <stop offset="1" stopColor={`hsl(${hue} 30% 9%)`} />
        </linearGradient>
      </defs>
      <rect width={100} height={100} fill={`url(#${id})`} />
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
                fill={`hsl(${hue} 70% 66%)`}
              />
            ),
        ),
      )}
    </svg>
  );

  if (!ring) return svg;
  return (
    <span className={`inline-block shrink-0 rounded-full bg-brass-gradient p-[3px] shadow-glow-brass ${className ?? ''}`}>
      <span className="block overflow-hidden rounded-full border-2 border-vault-deep">{svg}</span>
    </span>
  );
}
