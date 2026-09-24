'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { Badge, buttonVariantClass } from '@chosn/ui';
import { Reveal } from '@/components/fx/Reveal';
import { CountUp } from '@/components/fx/CountUp';
import { PriceChart, makeSeries } from '@/components/ui/PriceChart';
import { SneakerArt } from '@/components/ui/SneakerArt';
import { paletteFor } from '@/lib/sneaker/palette';

export interface TerminalOffer {
  retailer: string;
  total: number;
  inStock: boolean;
}

export interface TerminalData {
  name: string;
  colorway: string;
  brand: string;
  styleCode: string;
  href: string;
  current: number;
  best: number;
  avg30: number;
  avg90: number;
  trendPct: number;
  signalLabel: string;
  signalState: 'buy' | 'wait' | 'neutral';
  offers: TerminalOffer[];
}

const inr = (n: number) => `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n))}`;

/** The "trading terminal" showpiece: live-styled chart + ranked offers. */
export function MarketTerminal({ data }: { data: TerminalData }) {
  const [range, setRange] = useState<30 | 90>(90);
  const full = useMemo(
    () => makeSeries({ current: data.current, avg30: data.avg30, avg90: data.avg90, seed: data.styleCode }),
    [data],
  );
  const series = range === 90 ? full : full.slice(-30);
  const palette = paletteFor(data.colorway, data.brand);
  const down = data.trendPct <= 0;

  return (
    <section data-stage="terminal" id="terminal" className="relative py-28 sm:py-36" aria-labelledby="terminal-h">
      <div className="mx-auto max-w-[90rem] px-5 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="eyebrow">The terminal</p>
          </Reveal>
          <Reveal delay={0.06}>
            <h2 id="terminal-h" className="mt-4 font-display text-[clamp(2.4rem,6vw,4.5rem)] font-bold leading-[0.98] tracking-tight text-text">
              Built like a trading floor. <span className="text-brass-gradient">For sneakers.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mx-auto mt-5 max-w-xl text-lg text-text-soft">
              Prices are the most important thing on the page, so they are the biggest thing on the page — with the history to back them up.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.1} className="mt-14">
          <div className="panel edge-glow ticks relative overflow-hidden">
            <div aria-hidden className="aurora !opacity-70" />
            <div className="relative grid lg:grid-cols-[1.65fr_1fr]">
              {/* chart column */}
              <div className="border-b border-text/[0.08] p-5 sm:p-8 lg:border-b-0 lg:border-r">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <span className="hidden h-14 w-20 shrink-0 items-center justify-center bg-vault-deep/70 sm:flex">
                      <SneakerArt colorway={data.colorway} brand={data.brand} palette={palette} className="h-11 w-16" shadow={false} />
                    </span>
                    <div>
                      <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-brass">{data.brand}</p>
                      <p className="font-display text-2xl font-semibold text-text">{data.name}</p>
                      <p className="font-mono text-meta text-text-faint">{data.styleCode}</p>
                    </div>
                  </div>
                  <div role="group" aria-label="Chart range" className="flex border border-text/15">
                    {([30, 90] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        aria-pressed={range === r}
                        onClick={() => setRange(r)}
                        className={`px-3.5 py-1.5 font-mono text-meta transition-colors ${range === r ? 'bg-brass text-vault-deep' : 'text-text-soft hover:text-text'}`}
                      >
                        {r}D
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-end gap-x-5 gap-y-2">
                  <p className="font-mono text-[clamp(2.75rem,6vw,4.25rem)] font-medium leading-none text-text">
                    <CountUp to={data.current} prefix="₹" />
                  </p>
                  <p className={`pb-1.5 font-mono text-data-delta font-semibold ${down ? 'text-signal' : 'text-rust'}`}>
                    {down ? '▼' : '▲'} {Math.abs(data.trendPct).toFixed(1)}% vs 90-day avg
                  </p>
                  <Badge state={data.signalState} className="mb-1">
                    {data.signalLabel}
                  </Badge>
                </div>

                <PriceChart series={series} avg30={data.avg30} avg90={data.avg90} height={300} accent={down ? 'signal' : 'rust'} className="mt-4" />
                <p className="mt-3 font-mono text-[0.65rem] text-text-faint">
                  Illustrative trajectory drawn from this sneaker&apos;s real 30- and 90-day averages.
                </p>
              </div>

              {/* offers column */}
              <div className="flex flex-col p-5 sm:p-8">
                <p className="eyebrow">Ranked offers</p>
                <ul className="mt-4 divide-y divide-text/[0.07]">
                  {data.offers.slice(0, 5).map((o, i) => (
                    <li key={o.retailer} className="flex items-center justify-between gap-3 py-3.5">
                      <span className="flex items-center gap-3">
                        <span className={`flex h-6 w-6 items-center justify-center font-mono text-[0.7rem] ${i === 0 ? 'bg-brass text-vault-deep' : 'border border-text/15 text-text-faint'}`}>
                          {i + 1}
                        </span>
                        <span className="text-ui-label font-medium text-text">{o.retailer}</span>
                        {!o.inStock && <span className="font-mono text-[0.65rem] text-rust">out of stock</span>}
                      </span>
                      <span className={`font-mono text-data-inline tabular-nums ${i === 0 ? 'text-brass-bright' : 'text-text'}`}>{inr(o.total)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-6">
                  <Link href={data.href} className={buttonVariantClass('primary', 'w-full !py-3.5')}>
                    Open full comparison <ArrowUpRight className="h-4 w-4" aria-hidden />
                  </Link>
                  <p className="mt-3 flex items-center gap-2 text-meta text-text-faint">
                    <ShieldCheck className="h-3.5 w-3.5 text-signal" aria-hidden />
                    We route you out — we never sell or take payment.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
