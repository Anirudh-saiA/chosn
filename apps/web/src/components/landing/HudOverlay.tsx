'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export interface HeroChip {
  label: string;
  price: string;
  pill: { text: string; tone: 'signal' | 'amber' };
}

/** Where each card sits, and where its laser lands on the shoe (fractions of the viewport — the 3D stage is fixed to it). */
const SLOTS = [
  { pos: { right: '5%', top: '13%' }, target: { x: 0.685, y: 0.32 } }, // laces
  { pos: { right: '4%', top: '64%' }, target: { x: 0.9, y: 0.44 } }, // toe cap
  { pos: { left: '50%', top: '70%' }, target: { x: 0.62, y: 0.49 } }, // ice sole
];

interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Glass HUD price tags floating around the 3D shoe, each tethered to a
 * focal point on it by an animated laser line. Purely decorative
 * (aria-hidden); the same prices are in the catalog below.
 */
export function HudOverlay({ chips }: { chips: HeroChip[] }) {
  const reduce = useReducedMotion();
  const boxRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [size, setSize] = useState({ w: 1, h: 1 });

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => {
      const b = box.getBoundingClientRect();
      setSize({ w: b.width || 1, h: b.height || 1 });
      const next: Line[] = [];
      chips.slice(0, SLOTS.length).forEach((_, i) => {
        const el = cardRefs.current[i];
        if (!el) return;
        const r = el.getBoundingClientRect();
        const t = SLOTS[i]!.target;
        const tx = t.x * window.innerWidth - b.left;
        const ty = t.y * window.innerHeight - b.top;
        const cx = r.left - b.left + r.width / 2;
        const cy = r.top - b.top + r.height / 2;
        const dx = tx - cx;
        const dy = ty - cy;
        // leave from the card edge nearest the target
        const horizontal = Math.abs(dx) / r.width > Math.abs(dy) / r.height;
        const x1 = horizontal ? cx + Math.sign(dx) * (r.width / 2) : cx;
        const y1 = horizontal ? cy : cy + Math.sign(dy) * (r.height / 2);
        next.push({ x1, y1, x2: tx, y2: ty });
      });
      setLines(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [chips]);

  return (
    <div ref={boxRef} aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
      <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${size.w} ${size.h}`}>
        <defs>
          <linearGradient id="laser-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8fd6ff" />
            <stop offset="1" stopColor="#7c5cff" />
          </linearGradient>
        </defs>
        {lines.map((l, i) => (
          <g key={i}>
            <motion.line
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              stroke="url(#laser-grad)"
              strokeWidth="1"
              strokeOpacity="0.85"
              className={reduce ? undefined : 'laser-line'}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.9, delay: 1.6 + i * 0.18 }}
            />
            <circle cx={l.x2} cy={l.y2} r="9" fill="#8fd6ff" opacity="0.14">
              {!reduce && <animate attributeName="r" values="4;11;4" dur="2.4s" repeatCount="indefinite" begin={`${i * 0.4}s`} />}
            </circle>
            <circle cx={l.x2} cy={l.y2} r="2.6" fill="#EAEFFC" stroke="#7c5cff" strokeWidth="1" />
          </g>
        ))}
      </svg>

      {chips.slice(0, SLOTS.length).map((c, i) => (
        <motion.div
          key={c.label}
          initial={reduce ? false : { opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 1.2 + i * 0.16, ease: [0.16, 1, 0.3, 1] }}
          className="absolute"
          style={SLOTS[i]!.pos}
        >
          <div
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            className="hud-card animate-float flex min-w-[15rem] flex-col gap-2 px-4 py-3 shadow-lift"
            style={{ animationDelay: `${i * 1.3}s` }}
          >
            <span className="flex items-center justify-between gap-6 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-text-faint">
              {c.label}
              <span className="h-1 w-1 rounded-full bg-ice shadow-[0_0_8px_2px_rgba(143,214,255,.8)]" />
            </span>
            <span className="flex items-end justify-between gap-4">
              <span className="font-mono text-[1.6rem] font-medium leading-none tracking-tight text-text">{c.price}</span>
              <span
                className={`inline-flex items-center border px-2 py-0.5 font-mono text-[0.7rem] font-semibold ${
                  c.pill.tone === 'signal'
                    ? 'border-signal/60 bg-signal/10 text-signal shadow-[0_0_14px_-3px_rgba(46,242,166,.6)]'
                    : 'border-brass/60 bg-brass/10 text-brass shadow-[0_0_14px_-3px_rgba(255,168,0,.6)]'
                }`}
              >
                {c.pill.text}
              </span>
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
