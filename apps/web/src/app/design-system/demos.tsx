'use client';

import { useMemo, useState } from 'react';
import { buttonVariantClass } from '@chosn/ui';
import { PriceChart, makeSeries } from '@/components/ui/PriceChart';
import { CountUp } from '@/components/fx/CountUp';
import { Magnetic } from '@/components/fx/Magnetic';
import { Marquee } from '@/components/fx/Marquee';
import { Reveal } from '@/components/fx/Reveal';
import { TiltCard } from '@/components/fx/TiltCard';

export function ChartDemo() {
  const [accent, setAccent] = useState<'signal' | 'rust' | 'brass'>('signal');
  const series = useMemo(() => makeSeries({ current: 18750, avg30: 19900, avg90: 21200, seed: 'design-system' }), []);
  return (
    <div>
      <div role="group" aria-label="Chart accent" className="mb-4 flex flex-wrap gap-2">
        {(['signal', 'rust', 'brass'] as const).map((a) => (
          <button
            key={a}
            type="button"
            aria-pressed={accent === a}
            onClick={() => setAccent(a)}
            className={`min-h-[44px] border px-4 font-mono text-data-delta font-semibold capitalize ${
              accent === a ? 'border-brass-bright bg-brass-gradient text-vault-deep' : 'border-text/15 text-text-soft hover:border-brass/60'
            }`}
          >
            {a}
          </button>
        ))}
      </div>
      <div className="panel p-3 sm:p-5">
        <PriceChart series={series} avg30={19900} avg90={21200} accent={accent} height={260} ariaLabel="Sample 90-day price history for a sneaker" />
      </div>
    </div>
  );
}

export function MotionDemo() {
  const [n, setN] = useState(0);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="panel p-6">
        <p className="eyebrow">Reveal</p>
        <p className="mt-2 text-meta text-text-soft">Fade + rise on scroll-in. Reduced motion renders the final state.</p>
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <Reveal key={`${n}-${i}`} delay={i * 0.1} y={16} once={false}>
              <div className="border border-text/10 bg-vault-raised px-4 py-2.5 font-mono text-data-inline text-text">Row {i + 1}</div>
            </Reveal>
          ))}
        </div>
        <button type="button" onClick={() => setN((v) => v + 1)} className={buttonVariantClass('secondary', 'mt-4 min-h-[44px]')}>
          Replay
        </button>
      </div>

      <div className="panel p-6">
        <p className="eyebrow">CountUp</p>
        <p className="mt-2 text-meta text-text-soft">Eased count on first view.</p>
        <p key={n} className="mt-4 font-mono text-5xl font-medium text-brass-bright">
          <CountUp to={48210} prefix="₹" />
        </p>
        <p className="mt-2 font-mono text-2xl text-signal">
          <CountUp to={98} suffix="%" />
        </p>
      </div>

      <div className="panel p-6">
        <p className="eyebrow">TiltCard</p>
        <p className="mt-2 text-meta text-text-soft">Pointer-driven 3D tilt with glare. Hover it.</p>
        <TiltCard className="mt-4">
          <div className="panel ticks flex h-32 items-center justify-center font-display text-2xl font-bold text-text">Hover me</div>
        </TiltCard>
      </div>

      <div className="panel p-6">
        <p className="eyebrow">Magnetic</p>
        <p className="mt-2 text-meta text-text-soft">Wraps a CTA that leans toward the cursor.</p>
        <div className="mt-6 flex justify-center py-4">
          <Magnetic>
            <button type="button" className={buttonVariantClass('primary', 'min-h-[48px] px-7')}>
              Compare a price
            </button>
          </Magnetic>
        </div>
      </div>

      <div className="panel overflow-hidden p-6 md:col-span-2">
        <p className="eyebrow">Marquee</p>
        <p className="mt-2 text-meta text-text-soft">Endless ticker; pauses on hover, static for reduced motion.</p>
        <Marquee className="mt-4" duration={30}>
          {['StockX', 'GOAT', 'Nike India', 'Superkicks', 'VegNonVeg', 'Foot Locker', 'Adidas'].map((r) => (
            <span key={r} className="mx-6 font-display text-3xl font-bold text-text-faint">
              {r}
            </span>
          ))}
        </Marquee>
      </div>
    </div>
  );
}
