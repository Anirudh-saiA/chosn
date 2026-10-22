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
  textClass = 'max-w-3xl text-[clamp(1.6rem,3.2vw,2.6rem)] leading-[1.25]',
  triggerAt = 0.4,
}: {
  before?: string;
  first?: string;
  between?: string;
  second?: string;
  after?: string;
  textClass?: string;
  /** Fraction of the viewport height the text must climb above before the first phrase highlights. */
  triggerAt?: number;
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
      // The slit reveal covers the section until the band has opened, so the sweep must only start once
      // the text is actually in view: first phrase when the text reaches the upper 40%, second a touch later.
      // each phrase is simply on or off (the CSS transition animates the sweep), so it is smooth at any scroll speed
      const onA = top < vh * triggerAt;
      const onB = top < vh * (triggerAt - 0.08);
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
  }, [triggerAt]);

  const mark = 'rounded bg-transparent px-1.5 text-[#14213D] transition-[background-size,color] duration-[900ms] ease-out [background-image:linear-gradient(#FFD84A,#FFD84A)] [background-position:left] [background-repeat:no-repeat] [background-size:0%_100%] [box-decoration-break:clone]';

  return (
    <p ref={root} className={`${textClass} font-extrabold tracking-tight text-[#14213D]`}>
      {before}{' '}
      <mark ref={a} className={mark}>
        {first}
      </mark>
      {between}
      <mark ref={b} className={`${mark} [transition-delay:0.2s]`}>
        {second}
      </mark>{' '}
      {after}
    </p>
  );
}
