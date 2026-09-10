'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { Skateboard } from './Skateboard';
import { SneakerPlaceholder } from './SneakerPlaceholder';
import { LOCAL_HERO_IMAGE } from '@/lib/local-preview';

const HEADLINE_LINES = ['Every price.', 'One place.'];

/**
 * Local-only hero photography (Day 19). See lib/local-preview.ts for
 * the flag itself.
 *
 * Set `NEXT_PUBLIC_LOCAL_HERO_IMAGE` in `.env.local` to a path under
 * `/local-preview/` to preview the hero with a real photograph instead
 * of the generated placeholder mark. Unset — which is the case in CI
 * and on every deployed build — falls back to the placeholder, so this
 * file is safe to commit while the image itself never is:
 * `apps/web/public/local-preview/` is gitignored precisely because the
 * repo and the Vercel deployment are both public.
 *
 * This exists so the layout can be evaluated against real imagery
 * before paying for a licence. Swapping in licensed photography later
 * means dropping it in `public/` properly and pointing this at it —
 * the layout below doesn't change.
 */

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
      {/* Full-bleed as of Day 19 — the image now fills the entire
          section at every breakpoint, not just the right half on large
          screens. The earlier right-confined layout existed because the
          generated placeholder mark needed a light gradient floor and a
          left half of solid ink for the headline to sit on; a real
          photo can carry the whole frame, so the text now sits directly
          on top of it (see the scrim overlay just below, which is what
          keeps it legible over a full photo instead of a plain
          background). */}
      <motion.div
        ref={imageRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        initial={{ opacity: 0, scale: 1.05 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        style={{ rotateX, rotateY }}
        className="absolute inset-0 h-full w-full"
      >
        {LOCAL_HERO_IMAGE ? (
          // Local-preview branch — see the constant's own comment. A
          // plain <img>, not next/image: a gitignored, local-only asset
          // that's never part of a real build for next/image to optimize.
          <img
            src={LOCAL_HERO_IMAGE}
            alt=""
            className="h-full w-full object-cover object-center"
          />
        ) : (
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-b from-ink to-[#161616] lg:bg-none">
            {/* A soft off-center glow behind the mark — the one bit of
                depth standing in for what real photo lighting would give
                this frame for free. */}
            <div
              aria-hidden
              className="absolute right-[5%] top-[20%] h-[55vh] w-[55vh] rounded-full bg-ember/10 blur-[120px]"
            />

            {/* Speed lines — a skate/action-photo device (a shoe caught
                mid-trick, not sitting still), not a generic decoration:
                this is the "cool, in motion" energy standing in for real
                action photography, same honesty-over-fakery approach as
                the mark itself. */}
            <svg
              aria-hidden
              viewBox="0 0 400 400"
              className="pointer-events-none absolute h-[55vh] w-[55vh] opacity-[0.16]"
            >
              <line x1="60" y1="290" x2="180" y2="230" stroke="#F7F5F0" strokeWidth="3" strokeLinecap="round" />
              <line x1="40" y1="240" x2="140" y2="195" stroke="#F7F5F0" strokeWidth="3" strokeLinecap="round" />
              <line x1="30" y1="190" x2="110" y2="160" stroke="#F7F5F0" strokeWidth="3" strokeLinecap="round" />
            </svg>

            {/* A held, off-axis tilt — "caught mid-trick," not sitting
                level — plus a slow idle drift so the mark reads as alive
                even before the cursor-tilt above ever engages. Held to a
                modest ±3° range (down from an earlier, much wider swing)
                — a rotated shape's effective bounding box grows with the
                angle, and the wider version was part of what pushed it
                into the headline's space. `animate` resolves to a single
                static value under reduced motion rather than the same
                keyframe array with the transition duration zeroed out —
                an array `animate` at duration 0 still snaps through its
                keyframes, which is not "no motion." */}
            <motion.div
              initial={false}
              animate={prefersReducedMotion ? { rotate: -6 } : { rotate: [-4, -7, -4] }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }
              }
              className="relative"
            >
              <SneakerPlaceholder tone="bone" className="h-[34vh] w-auto max-w-[70%] sm:h-[40vh] lg:h-[46vh]" />

              {/* The board itself — kept a separate, clearly offset shape
                  rather than merged under the shoe, so the two stay
                  legible on their own rather than risking the kind of
                  unreadable overlap the first version of this mark had.
                  Positioned lower-left and counter-rotated slightly, like
                  it's mid-separation from the foot rather than pinned
                  directly beneath it — the same "caught mid-trick" idea
                  the speed lines and tilt already carry. */}
              <div
                aria-hidden
                className="absolute -bottom-[8%] -left-[18%] w-[85%] -rotate-[18deg] opacity-90"
              >
                <Skateboard tone="bone" className="h-auto w-full" />
              </div>
            </motion.div>
          </div>
        )}
      </motion.div>

      {LOCAL_HERO_IMAGE && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-rust px-4 py-1.5 text-center font-mono text-meta font-semibold uppercase tracking-[0.06em] text-vault"
        >
          Local preview only — unlicensed reference image, never committed or deployed
        </div>
      )}

      {/* Both scrims below exist only to keep our own headline/CTA
          legible over a photo. When the local-preview image is standing
          in as a complete, self-contained hero (its own copy baked into
          the pixels — see the text block's own comment further down),
          there's no overlaid text to protect, so skip them and let the
          photo show at full clarity. */}
      {!LOCAL_HERO_IMAGE && (
        <>
          {/* Left-side scrim — for the full-bleed image. With the photo
              running edge-to-edge instead of confined to the right
              half, the headline has nothing but the image itself behind
              it on the left, where it used to sit on solid `bg-ink`.
              Darkens the left ~2/3 and fades out before the right edge,
              so the photo still reads clearly over there. */}
          <div className="pointer-events-none absolute inset-y-0 left-0 h-full w-full bg-gradient-to-r from-ink/95 via-ink/55 to-transparent sm:from-ink/90 sm:via-ink/40 sm:to-transparent" />

          {/* Gradient floor so the headline reads over the placeholder/photo regardless of what's underneath. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink via-ink/70 to-transparent" />
        </>
      )}

      {/* Day 19: when the local-preview image already has a complete
          hero composition baked in (its own wordmark, headline, and
          CTA-less footer copy — see page.tsx's Masthead comment), our
          own headline/paragraph/CTA stack is hidden rather than
          rendered on top of it a second time. This only ever fires in
          local preview — unset in every real build, where the mark or
          a licensed photo needs this text same as always. */}
      {!LOCAL_HERO_IMAGE && (
        <div className="relative z-10 w-full px-6 pb-14 sm:px-10 sm:pb-20 lg:pb-24">
          <div className="mx-auto max-w-[90rem] lg:max-w-[52rem]">
            <h1 className="font-editorial text-[3.25rem] font-black leading-[0.95] tracking-tight text-bone sm:text-[5.5rem] lg:text-[6rem]">
              {HEADLINE_LINES.map((line, i) => (
                <span key={line} className="block overflow-hidden">
                  <motion.span
                    initial={{ y: '110%', opacity: 0 }}
                    animate={{ y: '0%', opacity: 1 }}
                    transition={
                      prefersReducedMotion
                        ? { duration: 0 }
                        : { duration: 0.7, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }
                    }
                    className="block"
                  >
                    {line}
                  </motion.span>
                </span>
              ))}
            </h1>

            <motion.p
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6, delay: 0.3 }}
              className="mt-5 max-w-[32ch] font-grotesk text-base text-bone/70 sm:text-lg"
            >
              Real-time price intelligence across every retailer and resale marketplace.
            </motion.p>

            <motion.div
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6, delay: 0.42 }}
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
      )}
    </section>
  );
}
