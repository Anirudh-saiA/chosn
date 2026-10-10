'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Scroll-driven slit reveal: a big title is held still in the middle of the screen
 * on a white sheet. As you scroll, a horizontal band opens through the middle of
 * that sheet (growing from a hairline to the full height), and the section
 * underneath shows through it. The title never moves; the band just eats it.
 * `children` start half a screen down so their top meets the band as it opens.
 */
export function SplitReveal({ index, eyebrow, title, children }: { index: string; eyebrow?: string; title: string; children: ReactNode }) {
  const stage = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = stage.current;
      const sh = sheet.current;
      if (!el || !sh) return;
      const r = el.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      const p = Math.min(1, Math.max(0, -r.top / span));
      const e = p * p * (3 - 2 * p); // slow start, decisive finish
      const half = e * 50;
      const t = 50 - half;
      const b = 50 + half;
      // outer rectangle minus the band (even-odd), so the band is a see-through window
      sh.style.clipPath = `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, 0 ${t}%, 100% ${t}%, 100% ${b}%, 0 ${b}%, 0 ${t}%)`;
      sh.style.visibility = p >= 1 ? 'hidden' : 'visible';
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

  return (
    <div className="relative">
      {/* tall track the sticky sheet lives in: half a screen of scroll to open the band */}
      <div ref={stage} aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-30 h-[150svh] motion-reduce:hidden">
        <div className="sticky top-0 h-svh w-full">
          <div ref={sheet} className="absolute inset-0 bg-white">
            <div className="flex h-full w-full items-center justify-center gap-[clamp(1rem,3vw,3rem)]">
              <span className="font-display text-[clamp(7rem,24vw,22rem)] leading-[0.8] text-[#0A0A0A]">{index}</span>
              <div>
                {eyebrow && <p className="font-mono text-[clamp(0.6rem,1.2vw,0.9rem)] font-bold uppercase tracking-[0.24em] text-[#0A0A0A]/60">{eyebrow}</p>}
                <p className="font-display text-[clamp(4rem,15vw,14rem)] uppercase leading-[0.9] tracking-[0.01em] text-[#0A0A0A]">{title}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="pt-[50svh] motion-reduce:pt-0">{children}</div>
    </div>
  );
}
