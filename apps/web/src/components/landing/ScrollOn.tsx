'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Flips `data-on` true while it is inside the viewport (above a line 20% up from the
 * bottom) and false again once it leaves, so children can animate in on the way down
 * and animate back out on the way up via `[data-on=true]` rules in globals.css.
 */
export function ScrollOn({ className = '', delay = 0, children }: { className?: string; delay?: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let t = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        window.clearTimeout(t);
        const next = !!e?.isIntersecting;
        t = window.setTimeout(() => setOn(next), next ? delay : 0);
      },
      { rootMargin: '0px 0px -20% 0px' },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(t);
    };
  }, [delay]);

  return (
    <div ref={ref} data-on={on} className={className}>
      {children}
    </div>
  );
}
