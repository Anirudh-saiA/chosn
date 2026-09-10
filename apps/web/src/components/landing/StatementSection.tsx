'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';

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
 *
 * Day 19: `public/images/statement-street.jpg` — a real, committed
 * asset, not a local-only reference photo. AI-generated monochrome
 * street-style image from StockCake, released CC0 / public domain (no
 * attribution required, commercial use explicitly permitted — see
 * stockcake.com/info/license). No visible logo, text, or brand mark.
 * Source is only 672×384 — soft once stretched across a 70vh box;
 * swap for a higher-resolution version if that shows.
 *
 * `public/images/statement-sneaker.jpg` (Pexels, also real/committed)
 * is the previous pick — left in place, unused, in case this one
 * doesn't work out and it's easier to just swap the `src` back.
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
          {/* 130% height, not the flex-centered small mark below — a
              real photo should read as full-bleed photography, not a
              centered icon. The extra 30% is scroll room for the GSAP
              parallax drift above to have somewhere to go without ever
              exposing an edge. */}
          <div ref={imageInnerRef} className="relative h-[130%] w-full">
            <Image
              src="/images/statement-street.jpg"
              alt=""
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="font-editorial text-[1.75rem] font-semibold leading-[1.15] tracking-tight text-ink sm:text-[2.5rem] lg:order-1 lg:text-[3rem]"
        >
          We don&apos;t sell sneakers. We show you where they&apos;re cheapest.
        </motion.p>
      </div>
    </section>
  );
}
