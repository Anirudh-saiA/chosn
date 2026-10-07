'use client';

import { useRef, type ReactNode } from 'react';

/**
 * A colour panel that lights up under the cursor: a soft spotlight follows the
 * pointer, a rim glow fades in, and the content lifts a touch. Pointer position
 * goes into CSS variables (no React state), so hovering never re-renders.
 */
export function GlowPanel({ children, bg, glow, className = '' }: { children: ReactNode; bg: string; glow: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - r.left}px`);
        el.style.setProperty('--my', `${e.clientY - r.top}px`);
      }}
      className={`glow-panel group relative overflow-hidden ${className}`}
      style={{ background: bg, ['--glow' as string]: glow }}
    >
      <div aria-hidden className="glow-panel-light pointer-events-none !absolute inset-0" />
      <div className="glow-panel-lift !absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
