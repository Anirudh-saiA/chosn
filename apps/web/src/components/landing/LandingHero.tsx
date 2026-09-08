'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { SneakerPlaceholder } from './SneakerPlaceholder';

const HEADLINE_LINES = ['Every price.', 'One place.'];

/**
 * The one screen the whole brief's motion language gets defined on —
 * every other section reuses this same fade/scale/stagger vocabulary
 * rather than inventing its own.
 *
 * `useReducedMotion()` (Framer Motion's own hook, reads
 * prefers-reduced-motion) gates every animated prop below: reduced
 * users get the final state immediately, no entrance, no tilt — not a
 * cosmetic toggle, the actual initial/animate values collapse to the
 * same value when it's true.
 */
export function LandingHero() {
  const prefersReducedMotion = useReducedMotion();
  const imageRef = useRef<HTMLDivElement>(null);

  // Magnetic tilt — a few degrees max, spring-smoothed so it settles
  // rather than snapping. Hero image only, per the brief.
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const springTiltX = useSpring(tiltX, { stiffness: 120, damping: 20 });
  const springTiltY = useSpring(tiltY, { stiffness: 120, damping: 20 });
  const rotateX = useTransform(springTiltY, [-0.5, 0.5], [4, -4]);
  const rotateY = useTransform(springTiltX, [-0.5, 0.5], [-4, 4]);

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (prefersReducedMotion) return;
    const rect = imageRef.current?.getBoundingClientRect();
    if (!rect) return;
    tiltX.set((event.clientX - rect.left) / rect.width - 0.5);
    tiltY.set((event.clientY - rect.top) / rect.height - 0.5);
  }

  function handleMouseLeave() {
    tiltX.set(0);
    tiltY.set(0);
  }

  return (
    <section className="relative flex min-h-[100svh] items-end overflow-hidden bg-ink">
      <motion.div
        ref={imageRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 1.05 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        style={{ rotateX, rotateY }}
        className="absolute inset-0"
      >
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-b from-ink to-[#161616]">
          {/* A soft off-center glow behind the mark — the one bit of
              depth standing in for what real photo lighting would give
              this frame for free. */}
          <div
            aria-hidden
            className="absolute -right-[10%] top-[15%] h-[70vh] w-[70vh] rounded-full bg-ember/10 blur-[120px]"
          />
          <SneakerPlaceholder tone="bone" className="relative h-[48vh] w-auto max-w-[80vw] sm:h-[58vh]" />
        </div>
      </motion.div>

      {/* Gradient floor so the headline reads over the placeholder/photo regardless of what's underneath. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink via-ink/70 to-transparent" />

      <div className="relative z-10 w-full px-6 pb-14 sm:px-10 sm:pb-20 lg:pb-24">
        <div className="mx-auto max-w-[90rem]">
          <h1 className="font-editorial text-[3.25rem] font-black leading-[0.95] tracking-tight text-bone sm:text-[5.5rem] lg:text-[7.5rem]">
            {HEADLINE_LINES.map((line, i) => (
              <span key={line} className="block overflow-hidden">
                <motion.span
                  initial={prefersReducedMotion ? false : { y: '110%', opacity: 0 }}
                  animate={{ y: '0%', opacity: 1 }}
                  transition={{ duration: 0.7, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  className="block"
                >
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>

          <motion.p
            initial={prefersReducedMotion ? false : { y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-5 max-w-[32ch] font-grotesk text-base text-bone/70 sm:text-lg"
          >
            Real-time price intelligence across every retailer and resale marketplace.
          </motion.p>

          <motion.div
            initial={prefersReducedMotion ? false : { y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.42 }}
            className="mt-8"
          >
            <Link
              href="/sneakers"
              className="inline-flex items-center border border-ember bg-ember px-8 py-3.5 font-grotesk text-sm font-medium uppercase tracking-[0.08em] text-bone transition-colors duration-200 hover:bg-transparent hover:text-ember"
            >
              Compare now
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
