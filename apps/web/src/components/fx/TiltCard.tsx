'use client';

import { useRef, type ReactNode, type MouseEvent } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * Pointer-driven 3D tilt with a moving specular glare. CSS variables
 * only (no React state per mousemove) so it stays at 60fps. Pure
 * progressive enhancement: touch/reduced-motion get a static card.
 */
export function TiltCard({
  children,
  className = '',
  max = 8,
  glare = true,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
  glare?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  function onMove(e: MouseEvent<HTMLDivElement>) {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    ref.current.style.setProperty('--rx', `${((0.5 - py) * max).toFixed(2)}deg`);
    ref.current.style.setProperty('--ry', `${((px - 0.5) * max).toFixed(2)}deg`);
    ref.current.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
    ref.current.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
  }
  function onLeave() {
    if (!ref.current) return;
    ref.current.style.setProperty('--rx', '0deg');
    ref.current.style.setProperty('--ry', '0deg');
  }

  return (
    <div className="group/tilt [perspective:1000px]" onMouseMove={onMove} onMouseLeave={onLeave}>
      <div
        ref={ref}
        className={`relative transition-transform duration-300 ease-out [transform-style:preserve-3d] [transform:rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))] ${className}`}
      >
        {children}
        {glare && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 mix-blend-soft-light transition-opacity duration-300 group-hover/tilt:opacity-100"
            style={{
              background:
                'radial-gradient(400px circle at var(--gx,50%) var(--gy,50%), rgba(255,255,255,.35), transparent 55%)',
            }}
          />
        )}
      </div>
    </div>
  );
}
