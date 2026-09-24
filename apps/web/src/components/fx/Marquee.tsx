import type { ReactNode } from 'react';

/** Seamless CSS marquee. Children are rendered twice; second copy is aria-hidden. */
export function Marquee({
  children,
  duration = 40,
  reverse = false,
  className = '',
}: {
  children: ReactNode;
  duration?: number;
  reverse?: boolean;
  className?: string;
}) {
  return (
    <div className={`marquee-shell overflow-hidden ${className}`}>
      <div
        className={`marquee-track flex w-max ${reverse ? 'reverse' : ''}`}
        style={{ ['--marquee-duration' as string]: `${duration}s` }}
      >
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}
