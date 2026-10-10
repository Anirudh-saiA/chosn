'use client';

import { useEffect, useRef } from 'react';

/**
 * Marker-pen highlight tied to scroll: scrolling down sweeps the yellow across the
 * two key phrases one after the other, scrolling back up wipes it away again.
 */
export function ScrollHighlight({
  before = 'The same sneaker across',
  first = 'every retailer',
  between = ', ',
  second = 'shipping included',
  after = "— so you see what you'll actually pay.",
}: {
  before?: string;
  first?: string;
  between?: string;
  second?: string;
  after?: string;
} = {}) {
  const root = useRef<HTMLParagraphElement>(null);
  const a = useRef<HTMLElement>(null);
  const b = useRef<HTMLElement>(null);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = root.current;
      if (!el || !a.current || !b.current) return;
      const vh = window.innerHeight;
      const top = el.getBoundingClientRect().top;
      // 0 when the text enters the lower part of the screen, 1 once it has climbed to the upper third
      const p = Math.min(1, Math.max(0, (vh * 0.8 - top) / (vh * 0.5)));
      // each phrase is simply on or off (the CSS transition animates the sweep), so it is smooth at any scroll speed
      const onA = p > 0.15;
      const onB = p > 0.6;
      a.current.style.backgroundSize = onA ? '100% 100%' : '0% 100%';
      b.current.style.backgroundSize = onB ? '100% 100%' : '0% 100%';
      a.current.style.color = onA ? '#0A0A0A' : '';
      b.current.style.color = onB ? '#0A0A0A' : '';
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const mark = 'rounded bg-transparent px-1.5 text-[#14213D] transition-[background-size,color] duration-500 ease-out [background-image:linear-gradient(#FFD84A,#FFD84A)] [background-position:left] [background-repeat:no-repeat] [background-size:0%_100%] [box-decoration-break:clone]';

  return (
    <p ref={root} className="max-w-3xl text-[clamp(1.6rem,3.2vw,2.6rem)] font-extrabold leading-[1.25] tracking-tight text-[#14213D]">
      {before}{' '}
      <mark ref={a} className={mark}>
        {first}
      </mark>
      {between}
      <mark ref={b} className={mark}>
        {second}
      </mark>{' '}
      {after}
    </p>
  );
}
