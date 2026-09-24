'use client';

import { useEffect, useState } from 'react';

export function useCountdown(iso: string) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now == null) return null;
  const diff = Math.max(0, new Date(iso).getTime() - now);
  return {
    d: Math.floor(diff / 86_400_000),
    h: Math.floor((diff / 3_600_000) % 24),
    m: Math.floor((diff / 60_000) % 60),
    s: Math.floor((diff / 1000) % 60),
    done: diff === 0,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Live countdown. The role="timer" wrapper is not an aria-live region, so
 * screen readers get the coarse label (updated each second, not announced).
 */
export function Countdown({ iso, size = 'sm' }: { iso: string; size?: 'sm' | 'lg' }) {
  const c = useCountdown(iso);
  const lg = size === 'lg';
  if (!c) return <div className={lg ? 'h-24' : 'h-12'} aria-hidden />;
  if (c.done) {
    return <p className={`font-mono font-semibold text-signal ${lg ? 'text-2xl' : 'text-ui-label'}`}>Releasing now</p>;
  }
  const cells = [
    ['Days', c.d],
    ['Hrs', c.h],
    ['Min', c.m],
    ['Sec', c.s],
  ] as const;
  return (
    <div
      role="timer"
      aria-label={`Time until release: ${c.d} days ${c.h} hours ${c.m} minutes`}
      className={lg ? 'flex gap-2 sm:gap-3' : 'flex gap-1.5'}
    >
      {cells.map(([l, v]) => (
        <div
          key={l}
          className={
            lg
              ? 'min-w-[4.25rem] flex-1 border border-brass/25 bg-vault-deep/70 px-2 py-3 text-center sm:min-w-[5.5rem] sm:py-4'
              : 'min-w-[3rem] border border-text/[0.12] bg-vault-deep/70 px-2 py-1.5 text-center'
          }
        >
          <span
            className={`block font-mono font-medium leading-none tabular-nums text-text ${lg ? 'text-3xl sm:text-5xl' : 'text-lg'}`}
          >
            {pad(v)}
          </span>
          <span
            className={`mt-1.5 block font-mono uppercase tracking-[0.2em] text-text-faint ${lg ? 'text-[0.65rem]' : 'text-[0.55rem]'}`}
          >
            {lg ? l : l[0]}
          </span>
        </div>
      ))}
    </div>
  );
}
