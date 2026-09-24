'use client';

import { useRef, type ReactNode, type MouseEvent } from 'react';
import { useReducedMotion } from 'framer-motion';

/** Wraps a CTA so it drifts a few px toward the cursor. */
export function Magnetic({ children, strength = 0.25 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();

  function onMove(e: MouseEvent) {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - (r.left + r.width / 2)) * strength;
    const y = (e.clientY - (r.top + r.height / 2)) * strength;
    ref.current.style.transform = `translate(${x}px, ${y}px)`;
  }
  function onLeave() {
    if (ref.current) ref.current.style.transform = 'translate(0,0)';
  }

  return (
    <span
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="inline-block transition-transform duration-300 ease-out"
    >
      {children}
    </span>
  );
}
