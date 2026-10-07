'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { HERO_SHOE_EVENT } from './PageAmbient';
import { SHOES } from './shoes';

const INTERVAL = 4800; // ms each shoe stays centred before the carousel slides on

/**
 * Hero: a full-bleed colour stage (the colour is the centred shoe's), the CHOSN
 * wordmark and tagline set in the middle of it, and a Netflix-style carousel:
 * the active shoe sits dead centre and large, its neighbours peek in at the
 * sides, and the row slides along on its own (loops forever, swipe / arrows work,
 * and it keeps rotating even while the cursor is on it). The stage recolours as the centred shoe changes.
 */
export function HeroSlider() {
  const n = SHOES.length;
  const [i, setI] = useState(0);
  const drag = useRef<number | null>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setTimeout(() => setI((k) => (k + 1) % n), INTERVAL);
    return () => window.clearTimeout(t);
  }, [i, n]);

  // tell the page light which shoe is centred
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(HERO_SHOE_EVENT, { detail: SHOES[i]!.id }));
  }, [i]);

  const s = SHOES[i]!;
  const go = (d: number) => setI((k) => (k + d + n) % n);

  return (
    <section data-ambient="hero" className="relative w-full" aria-roledescription="carousel" aria-label="Featured sneakers">
      {/* soft spill of the stage colour onto the page below it */}
      {SHOES.map((shoe, k) => (
        <div
          key={shoe.id}
          aria-hidden
          className="ambient-breathe pointer-events-none absolute -bottom-6 inset-x-[8%] h-24 blur-[56px] transition-opacity duration-[1600ms] ease-in-out"
          style={{ opacity: k === i ? 0.9 : 0, background: shoe.glow }}
        />
      ))}

      <div
        className="relative flex min-h-[43rem] w-full select-none flex-col overflow-hidden rounded-b-[2.75rem] transition-colors duration-[900ms] lg:h-[calc(100svh-4rem)] lg:max-h-[58rem] lg:min-h-[40rem]"
        style={{ background: s.bg, color: s.fg, ['--sw' as string]: 'min(92vw, 52rem)' }}
        onPointerDown={(e) => {
          drag.current = e.clientX;
        }}
        onPointerUp={(e) => {
          if (drag.current == null) return;
          const dx = e.clientX - drag.current;
          drag.current = null;
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        }}
      >
        {/* the wordmark: huge, behind the shoes so they overlap it */}
        <h1 className="pointer-events-none absolute inset-x-0 top-[9%] z-0 text-center font-display text-[clamp(7rem,21vw,19rem)] uppercase leading-[0.8] tracking-[0.01em] text-white [text-shadow:0_2px_30px_rgba(255,255,255,0.25)]">
          CHOSN.
        </h1>

        {/* carousel: every slide sits at its offset from the centred one */}
        <div className="hero-track absolute inset-x-0 z-10">
          {SHOES.map((shoe, k) => {
            const d = ((k - i + n + Math.floor(n / 2)) % n) - Math.floor(n / 2); // -3 .. 2
            const abs = Math.abs(d);
            const active = d === 0;
            return (
              <div
                key={shoe.id}
                aria-hidden={!active}
                aria-roledescription="slide"
                className="absolute left-1/2 top-0 h-full w-[var(--sw)] transition-[transform,opacity,filter] duration-[1000ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[transform,opacity]"
                style={{
                  transform: `translateX(calc(-50% + ${d} * var(--sw) * 0.74)) scale(${active ? 1 : abs === 1 ? 0.66 : 0.5})`,
                  opacity: active ? 1 : abs === 1 ? 0.32 : 0,
                  filter: active ? 'none' : 'blur(2px)',
                  zIndex: active ? 2 : 1,
                }}
              >
                <div className="relative mx-auto h-full w-full">
                  <div className={active ? 'shoe-float absolute inset-0' : 'absolute inset-0'}>
                    <img
                      src={shoe.src}
                      alt={active ? shoe.alt : ''}
                      decoding="async"
                      draggable={false}
                      className="h-full w-full object-contain drop-shadow-[0_30px_30px_rgba(0,0,0,0.38)]"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* tagline + actions, centred under the shoe */}
        <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center px-5 pb-4 text-center sm:pb-5">
          <p className="font-display text-[clamp(1.9rem,4.6vw,3.6rem)] uppercase leading-[1.02] tracking-[0.02em]">
            Where Sneaker Culture Comes Together.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/sneakers?q=${encodeURIComponent(s.keyword)}`}
              className="btn-shine btn-shine-idle [--shine:255_190_70] rounded-full bg-white px-8 py-3.5 font-sans text-[0.72rem] font-extrabold uppercase tracking-[0.2em] text-[#14213D] shadow-[0_10px_24px_-10px_rgba(0,0,0,0.5)] hover:shadow-[0_16px_30px_-10px_rgba(0,0,0,0.6)]"
            >
              Compare now
            </Link>
          </div>

          {/* Netflix-style segmented progress + arrows */}
          <div className="mt-6 flex items-center gap-4">
            <button type="button" onClick={() => go(-1)} aria-label="Previous sneaker" className="p-1.5 opacity-80 transition-opacity hover:opacity-100">
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </button>
            <div className="flex items-center gap-2" role="tablist" aria-label="Choose sneaker">
              {SHOES.map((shoe, k) => (
                <button
                  key={shoe.id}
                  type="button"
                  role="tab"
                  aria-selected={k === i}
                  aria-label={`${shoe.brand} ${shoe.model}`}
                  onClick={() => setI(k)}
                  className="group py-3"
                >
                  <span className={`relative block h-[3px] overflow-hidden bg-white/35 transition-all duration-500 ${k === i ? 'w-14' : 'w-7 group-hover:bg-white/60'}`}>
                    {k === i && (
                      <span
                        key={i}
                        className="hero-progress absolute inset-y-0 left-0 bg-white"
                        style={{ animationDuration: `${INTERVAL}ms` }}
                      />
                    )}
                  </span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => go(1)} aria-label="Next sneaker" className="p-1.5 opacity-80 transition-opacity hover:opacity-100">
              <ArrowRight className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
