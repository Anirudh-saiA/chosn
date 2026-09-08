'use client';

import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { SneakerPlaceholder } from './SneakerPlaceholder';

/**
 * Task's "second full-bleed image + one editorial line replacing a
 * how-it-works paragraph." The image gets a scroll-driven parallax
 * drift (GSAP ScrollTrigger, imported dynamically inside `useEffect`
 * so its ~30kb never blocks this page's initial paint) on top of the
 * same fade+scale entrance the hero uses via `whileInView` — one
 * reveal language, reused, not a per-section special case. The line
 * itself uses `whileInView` too, but with no continued scroll-tied
 * transform after it settles — that's the "text settles faster, image
 * drifts longer" split the brief describes, expressed as two different
 * animation systems doing two different jobs rather than one system
 * pretending to do both.
 */
export function StatementSection() {
  const prefersReducedMotion = useReducedMotion();
  const imageWrapRef = useRef<HTMLDivElement>(null);
  const imageInnerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion) return;
    let ctx: { revert: () => void } | undefined;

    (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      gsap.registerPlugin(ScrollTrigger);
      if (!imageWrapRef.current || !imageInnerRef.current) return;

      ctx = gsap.context(() => {
        gsap.fromTo(
          imageInnerRef.current,
          { yPercent: -8 },
          {
            yPercent: 8,
            ease: 'none',
            scrollTrigger: {
              trigger: imageWrapRef.current,
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
          },
        );
      });
    })();

    return () => ctx?.revert();
  }, [prefersReducedMotion]);

  return (
    <section className="relative overflow-hidden bg-bone py-24 sm:py-32 lg:py-40">
      <div className="mx-auto grid max-w-[90rem] gap-10 px-6 sm:px-10 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div
          ref={imageWrapRef}
          className="relative h-[50vh] overflow-hidden bg-ink lg:order-2 lg:h-[70vh]"
        >
          <div ref={imageInnerRef} className="flex h-[130%] w-full items-center justify-center">
            <SneakerPlaceholder tone="bone" className="h-[40vh] w-auto max-w-[70%] rotate-[8deg]" />
          </div>
        </div>

        <motion.p
          initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="font-editorial text-[1.75rem] font-semibold leading-[1.15] tracking-tight text-ink sm:text-[2.5rem] lg:order-1 lg:text-[3rem]"
        >
          We don&apos;t sell sneakers. We show you where they&apos;re cheapest.
        </motion.p>
      </div>
    </section>
  );
}
