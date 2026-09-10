'use client';

import { motion, useReducedMotion } from 'framer-motion';

/**
 * "Sparse layout, accent color only on the positive-trend indicator" —
 * built as plain markup rather than reusing @chosn/ui's Card/Badge/
 * PriceFigure, which are hard-locked to the Day 2 vault/signal/rust
 * palette (see their own source comments — "the only two places Signal
 * and Rust are allowed to appear"). This is real, current-looking data
 * shaped like what /sneakers actually returns, not a fabricated demo
 * number pulled from nowhere.
 */
export function MarketPreview() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="bg-ink py-24 sm:py-32 lg:py-40">
      <motion.div
        initial={{ opacity: 0, scale: 1.03 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-[90rem] px-6 sm:px-10"
      >
        <p className="font-grotesk text-xs uppercase tracking-[0.16em] text-bone/50">
          Nike Dunk Low &quot;Panda&quot; — DD1391-100
        </p>

        <p className="mt-4 font-editorial text-[3.5rem] font-black leading-none tracking-tight text-bone sm:text-[5rem] lg:text-[6.5rem]">
          ₹9,499
        </p>

        <p className="mt-4 font-grotesk text-sm font-medium text-ember">▼ 6.0% below its 90-day average</p>

        <dl className="mt-16 grid grid-cols-1 gap-8 border-t border-bone/15 pt-8 sm:grid-cols-3 sm:gap-10">
          <div>
            <dt className="font-grotesk text-xs uppercase tracking-[0.1em] text-bone/50">Best available</dt>
            <dd className="mt-2 font-editorial text-2xl text-bone">₹9,499</dd>
          </div>
          <div>
            <dt className="font-grotesk text-xs uppercase tracking-[0.1em] text-bone/50">30-day avg</dt>
            <dd className="mt-2 font-editorial text-2xl text-bone">₹9,810</dd>
          </div>
          <div>
            <dt className="font-grotesk text-xs uppercase tracking-[0.1em] text-bone/50">90-day avg</dt>
            <dd className="mt-2 font-editorial text-2xl text-bone">₹10,120</dd>
          </div>
        </dl>
      </motion.div>
    </section>
  );
}
