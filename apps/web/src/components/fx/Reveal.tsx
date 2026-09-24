'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

type Tag = 'div' | 'section' | 'li' | 'article' | 'header' | 'p' | 'span';

/**
 * The site's one entrance vocabulary: fade + rise, spring-out easing,
 * triggered once on scroll-into-view. `delay` staggers siblings.
 * Reduced-motion users get the final state immediately.
 */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
  as = 'div',
  once = true,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: Tag;
  once?: boolean;
}) {
  const reduce = useReducedMotion();
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount: 0.15, margin: '0px 0px -6% 0px' }}
      transition={reduce ? { duration: 0 } : { duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </Comp>
  );
}

/** Splits a headline into per-word masked rise-ins. */
export function WordReveal({
  text,
  className,
  delay = 0,
  as: HeadingTag = 'h1',
  immediate = false,
}: {
  text: string;
  className?: string;
  delay?: number;
  as?: 'h1' | 'h2' | 'h3' | 'p';
  /** Animate on mount instead of on scroll-into-view (hero). */
  immediate?: boolean;
}) {
  const reduce = useReducedMotion();
  const words = text.split(' ');
  return (
    <HeadingTag className={className} aria-label={text}>
      {words.map((w, i) => (
        <span key={`${w}-${i}`} className="inline-block overflow-hidden pb-[0.14em] align-bottom" aria-hidden>
          <motion.span
            className="inline-block"
            initial={reduce ? false : { y: '110%' }}
            {...(immediate
              ? { animate: { y: 0 } }
              : { whileInView: { y: 0 }, viewport: { once: true, amount: 0.6 } })}
            transition={reduce ? { duration: 0 } : { duration: 0.95, delay: delay + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
          >
            {w}
            {i < words.length - 1 ? ' ' : ''}
          </motion.span>
        </span>
      ))}
    </HeadingTag>
  );
}
