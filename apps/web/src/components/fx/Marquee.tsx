import type { ReactNode } from 'react';

/**
 * Seamless CSS marquee. The track holds two identical halves (the second is
 * aria-hidden); each half repeats the children `repeat` times so it is always
 * wider than the viewport, and `duration` is the time per repeat so speed stays
 * constant.
 */
export function Marquee({
  children,
  duration = 40,
  reverse = false,
  repeat = 1,
  className = '',
}: {
  children: ReactNode;
  duration?: number;
  reverse?: boolean;
  repeat?: number;
  className?: string;
}) {
  const copies = Array.from({ length: repeat }, (_, i) => <div key={i} className="flex shrink-0 items-center" aria-hidden={i > 0 || undefined}>{children}</div>);
  return (
    <div className={`marquee-shell overflow-hidden ${className}`}>
      <div
        className={`marquee-track flex w-max ${reverse ? 'reverse' : ''}`}
        style={{ ['--marquee-duration' as string]: `${duration * repeat}s` }}
      >
        <div className="flex shrink-0 items-center">{copies}</div>
        <div className="flex shrink-0 items-center" aria-hidden>
          {copies}
        </div>
      </div>
    </div>
  );
}
