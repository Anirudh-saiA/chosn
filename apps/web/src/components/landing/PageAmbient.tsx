'use client';

import { useEffect, useState } from 'react';
import { SHOES } from './shoes';

/** Fired by the hero slider so the page light follows the shoe on screen. */
export const HERO_SHOE_EVENT = 'chosn:hero-shoe';

/**
 * Page-wide ambient light. One fixed layer sits behind the whole page; each
 * shoe owns a pair of soft colour pools (top-right, bottom-left), and the pools
 * of the shoe in the section under the viewport centre fade in while the
 * others fade out. Only opacity animates (plus a slow drift), so it stays cheap.
 *
 * Sections opt in with `data-ambient="<shoe id>"`; the hero uses "hero", which
 * resolves to whichever shoe the hero slider is showing right now.
 */
export function PageAmbient() {
  const [active, setActive] = useState(SHOES[0]!.id);
  const [heroShoe, setHeroShoe] = useState(SHOES[0]!.id);

  useEffect(() => {
    const onHero = (e: Event) => setHeroShoe((e as CustomEvent<string>).detail);
    window.addEventListener(HERO_SHOE_EVENT, onHero);
    return () => window.removeEventListener(HERO_SHOE_EVENT, onHero);
  }, []);

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-ambient]'));
    let raf = 0;
    const pick = () => {
      raf = 0;
      const mid = window.innerHeight / 2;
      let best: HTMLElement | null = null;
      let bestDist = Infinity;
      for (const el of sections) {
        const r = el.getBoundingClientRect();
        const dist = r.top <= mid && r.bottom >= mid ? 0 : Math.min(Math.abs(r.top - mid), Math.abs(r.bottom - mid));
        if (dist < bestDist) {
          bestDist = dist;
          best = el;
        }
      }
      const id = best?.dataset.ambient;
      if (!id) return;
      setActive(id === 'hero' ? heroShoe : id);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(pick);
    };
    pick();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [heroShoe]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {SHOES.map((s) => (
        <div
          key={s.id}
          className="ambient-drift absolute -inset-[12%] transition-opacity duration-[1800ms] ease-in-out will-change-[opacity]"
          style={{
            opacity: s.id === active ? 1 : 0,
            background: [
              `radial-gradient(52% 48% at 88% 14%, ${s.glow}8c, transparent 72%)`,
              `radial-gradient(50% 46% at 8% 92%, ${s.glow}66, transparent 72%)`,
              `radial-gradient(70% 60% at 50% 50%, ${s.glow}1f, transparent 80%)`,
            ].join(','),
          }}
        />
      ))}
    </div>
  );
}
