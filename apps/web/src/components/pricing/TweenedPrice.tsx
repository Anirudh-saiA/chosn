'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { cx, PriceFigure } from '@chosn/ui';

export interface TweenedPriceProps {
  /** Raw number, not pre-formatted — this is what gets tweened. */
  value: number | null;
  deltaPct?: number | null;
  size?: 'hero' | 'inline';
  formatter: (n: number) => string;
  unavailableLabel?: string;
  className?: string;
}

/**
 * The Day 10 task 5 micro-motion: PriceFigure wrapped in a GSAP tween
 * that animates the displayed number from its old value to its new one.
 *
 * Deliberately does NOT animate on mount — only on a change after the
 * first render. Day 10's motion dial (4/10) is explicit: feedback-only,
 * responding to data changes and hover, never decorative entrance
 * motion. The size selector (PriceComparisonView) swaps this
 * component's `value` prop in place without remounting it, which is
 * what gives the tween something real to animate between.
 *
 * ease: 'power2.out' rather than the site's CSS --ease-chosn cubic-bezier
 * — matching that curve exactly needs GSAP's paid CustomEase plugin;
 * power2.out is core/free and has the same "decelerate into rest, never
 * overshoot" character, which is the part that matters here.
 */
export function TweenedPrice({
  value,
  deltaPct,
  size,
  formatter,
  unavailableLabel = 'Currently unavailable',
  className,
}: TweenedPriceProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValue = useRef(value);
  const tweenState = useRef({ v: value ?? 0 });

  useEffect(() => {
    // No previous number to animate from, or the value didn't actually
    // change (e.g. a re-render from an unrelated prop) — just show it.
    if (value === null || prevValue.current === null || prevValue.current === value) {
      setDisplayValue(value);
      prevValue.current = value;
      return;
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setDisplayValue(value);
      prevValue.current = value;
      return;
    }

    tweenState.current.v = prevValue.current;
    const tween = gsap.to(tweenState.current, {
      v: value,
      duration: 0.28, // sub-300ms per the brief
      ease: 'power2.out',
      onUpdate: () => setDisplayValue(tweenState.current.v),
      onComplete: () => setDisplayValue(value),
    });

    prevValue.current = value;
    return () => {
      tween.kill();
    };
  }, [value]);

  if (displayValue === null) {
    return (
      <span className={cx('font-mono text-data-inline text-text-soft', className)}>
        {unavailableLabel}
      </span>
    );
  }

  return (
    <PriceFigure
      value={formatter(displayValue)}
      deltaPct={deltaPct ?? undefined}
      size={size}
      className={className}
    />
  );
}
