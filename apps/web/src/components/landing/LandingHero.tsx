'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Command, Search } from 'lucide-react';
import { buttonVariantClass } from '@chosn/ui';
import { WordReveal } from '@/components/fx/Reveal';
import { Magnetic } from '@/components/fx/Magnetic';
import { HudOverlay, type HeroChip } from './HudOverlay';

export type { HeroChip };

/** Hero copy + search + floating "live price" chips over the 3D stage. */
export function LandingHero({
  catalogSize,
  retailerCount,
  chips,
}: {
  catalogSize: number;
  retailerCount: number;
  chips: HeroChip[];
}) {
  const reduce = useReducedMotion();
  const fade = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] as const },
        };

  return (
    <section data-stage="hero" className="relative flex min-h-[100svh] items-center pb-24 pt-[46svh] sm:pt-10">
      <div className="mx-auto w-full max-w-[90rem] px-5 sm:px-8">
        <div className="max-w-[58rem]">
          <motion.p
            {...fade(0.05)}
            className="inline-flex items-center gap-2.5 border border-chrome/30 bg-white/[0.04] px-3.5 py-1.5 font-mono text-[0.68rem] font-medium uppercase tracking-[0.2em] text-chrome-mid backdrop-blur-md"
          >
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-signal shadow-[0_0_10px_2px_rgba(46,242,166,.75)]" />
            India&apos;s sneaker price intelligence
          </motion.p>

          <div className="relative">
            <span aria-hidden className="pointer-events-none absolute -inset-x-10 -inset-y-6 -z-10 bg-[radial-gradient(60%_60%_at_35%_50%,rgba(124,92,255,0.28),transparent_70%)] blur-2xl" />
          <WordReveal
            as="h1"
            immediate
            delay={0.15}
            text="Every price. One place."
            className="mt-6 font-display text-[clamp(3.6rem,9vw,8.5rem)] font-bold leading-[0.86] tracking-[-0.015em] [filter:drop-shadow(0_8px_28px_rgba(0,0,0,0.55))_drop-shadow(0_0_1px_rgba(230,232,236,0.35))] text-text"
          />
          </div>

          <motion.p {...fade(0.7)} className="mt-7 max-w-[34rem] text-[1.0625rem] leading-relaxed text-text-soft sm:text-lg">
            We compare {catalogSize > 0 ? `${catalogSize}+ ` : ''}sneakers across {retailerCount} Indian retailers and global resale,
            tell you when it&apos;s the right time to buy — and send you straight to the best price. We never sell a thing.
          </motion.p>

          <motion.form
            {...fade(0.85)}
            action="/sneakers"
            method="get"
            role="search"
            className="group mt-9 flex max-w-xl items-stretch border border-text/15 bg-vault-deep/60 backdrop-blur-md transition-all duration-300 focus-within:border-ice focus-within:shadow-[0_0_0_4px_rgba(143,214,255,.14)]"
          >
            <label htmlFor="hero-q" className="sr-only">
              Search sneakers
            </label>
            <Search className="my-auto ml-4 h-4 w-4 shrink-0 text-brass" aria-hidden />
            <input
              id="hero-q"
              name="q"
              type="search"
              autoComplete="off"
              placeholder="Try “Dunk Low”, “Samba”, DD1391-100…"
              className="min-w-0 flex-1 bg-transparent px-3 py-4 font-sans text-body text-text outline-none placeholder:text-text-faint"
            />
            <kbd
              aria-hidden
              className="my-auto mr-2 hidden items-center gap-1 border border-violet/60 bg-violet/15 px-2 py-1 font-mono text-[0.68rem] text-violet-light shadow-[0_0_16px_-2px_rgba(124,92,255,0.7)] sm:flex"
            >
              <Command className="h-3 w-3" aria-hidden />K
            </kbd>
            <button type="submit" className={buttonVariantClass('primary', 'm-1.5 px-5')}>
              Compare
              <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />
            </button>
          </motion.form>

          <motion.div {...fade(1)} className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Magnetic>
              <Link href="/drops" className="link-underline inline-flex items-center gap-1.5 font-sans text-ui-label font-semibold text-text">
                Upcoming drops <ArrowUpRight className="h-3.5 w-3.5 text-brass" aria-hidden />
              </Link>
            </Magnetic>
            <Magnetic>
              <Link href="/community" className="link-underline inline-flex items-center gap-1.5 font-sans text-ui-label font-semibold text-text">
                Join the community <ArrowUpRight className="h-3.5 w-3.5 text-brass" aria-hidden />
              </Link>
            </Magnetic>
          </motion.div>
        </div>
      </div>

      <HudOverlay chips={chips} />

      <div aria-hidden className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 sm:flex">
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.3em] text-text-faint">Scroll</span>
        <span className="relative h-9 w-px overflow-hidden bg-text/15">
          <span className="absolute inset-x-0 top-0 h-3 animate-[float_1.8s_ease-in-out_infinite] bg-brass-bright" />
        </span>
      </div>
    </section>
  );
}
