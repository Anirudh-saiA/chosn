'use client';

import { useEffect, useRef } from 'react';
import { WHEEL_ITEMS } from './wheel-items';

const STEP = 9.2; // degrees between neighbouring cards
const VISIBLE = 3.5 * STEP; // cards beyond this angle from the top are hidden
const FADE = STEP; // ...and fade out over the last FADE degrees
const RING = WHEEL_ITEMS.length * STEP;

/**
 * Portrait shoe cards laid out on a semicircle. Scrolling the mouse wheel while the
 * pointer is over a card turns the whole wheel (down = clockwise, up = anti-clockwise,
 * and it loops); a wheel anywhere else scrolls the page as normal. Dragging a card
 * sideways turns it too (touch).
 */
export function ShoeWheel() {
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const theta = useRef(0); // current wheel angle
  const target = useRef(0);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let raf = 0;
    let last = 0;
    let snap = 0;

    const paint = (now = performance.now()) => {
      raf = 0;
      // frame-rate independent easing (about 0.25s time constant) so it glides at any refresh rate
      const dt = Math.min(64, last ? now - last : 16);
      last = now;
      theta.current += (target.current - theta.current) * (1 - Math.exp(-dt / 250));
      WHEEL_ITEMS.forEach((_, i) => {
        const c = cards.current[i];
        if (!c) return;
        // angle from the top, wrapped into (-RING/2, RING/2]
        let a = ((((i + 0.5) * STEP + theta.current) % RING) + RING) % RING;
        if (a > RING / 2) a -= RING;
        const abs = Math.abs(a);
        const o = abs >= VISIBLE ? 0 : Math.min(1, (VISIBLE - abs) / FADE);
        c.style.transform = `rotate(${a}deg) translateY(calc(var(--R) * -1)) translate(-50%, -50%)`;
        c.style.opacity = String(o);
        c.style.visibility = o === 0 ? 'hidden' : 'visible';
        c.style.zIndex = String(100 - Math.round(abs));
      });
      if (Math.abs(target.current - theta.current) > 0.01) raf = requestAnimationFrame(paint);
      else last = 0;
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(paint);
      // once input stops, ease on to the nearest card so one is always centred
      window.clearTimeout(snap);
      snap = window.setTimeout(() => {
        target.current = Math.round(target.current / STEP) * STEP;
        if (!raf) raf = requestAnimationFrame(paint);
      }, 180);
    };

    // wheel over a card turns the wheel; the cards (not the empty space) are the only wheel targets
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      target.current += dy * 0.15; // down = clockwise: one wheel notch turns one card
      kick();
    };
    el.addEventListener('wheel', onWheel, { passive: false });

    // drag (touch / pen / mouse): horizontal movement turns the wheel
    let down: number | null = null;
    const onDown = (e: PointerEvent) => {
      down = e.clientX;
    };
    const onMove = (e: PointerEvent) => {
      if (down == null) return;
      target.current += (e.clientX - down) * 0.15; // drag right = clockwise
      down = e.clientX;
      kick();
    };
    const onUp = () => {
      down = null;
    };
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    paint();
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(snap);
    };
  }, []);

  return (
    <div
      className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden [--R:clamp(52rem,100vw,150rem)] [--cw:clamp(6.5rem,13vw,20rem)]"
      style={{ height: 'calc(var(--R) * 0.085 + var(--cw) * 1.75)' }}
      role="group"
      aria-label="Sneakers by brand. Scroll over the cards to turn the wheel."
    >
      {/* wheel centre; cards are placed around it. It ignores the pointer so only the cards catch the wheel */}
      <div className="pointer-events-none absolute left-1/2 top-[calc(var(--R)+var(--cw)*0.75)]">
        <div ref={root} data-lenis-prevent className="relative">
          {WHEEL_ITEMS.map((it, i) => (
            <div
              key={`${it.brand}-${i}`}
              ref={(n) => {
                cards.current[i] = n;
              }}
              className="pointer-events-auto absolute left-0 top-0 aspect-[3/4.3] w-[var(--cw)] cursor-grab select-none overflow-hidden rounded-[1.6rem] border border-white/30 shadow-[0_28px_44px_-22px_rgba(0,0,0,0.5)] will-change-transform active:cursor-grabbing"
              style={{ background: it.bg, transformOrigin: '0 0' }}
            >
              <p className="absolute left-4 top-4 font-mono text-[clamp(0.55rem,0.9vw,0.75rem)] font-bold uppercase tracking-[0.3em] text-white/90">{it.brand}</p>
              <img
                src={it.src}
                alt={`${it.brand} ${it.name}`}
                decoding="async"
                draggable={false}
                className={`absolute inset-x-[4%] top-1/2 w-[92%] -translate-y-1/2 object-contain ${it.blend ? 'mix-blend-multiply' : 'drop-shadow-[0_18px_16px_rgba(0,0,0,0.35)]'}`}
              />
              <p className="absolute inset-x-4 bottom-4 font-sans text-[clamp(0.85rem,1.4vw,1.2rem)] font-extrabold uppercase leading-tight text-white">{it.name}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
