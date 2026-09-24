'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BellRing } from 'lucide-react';
import { Reveal } from '@/components/fx/Reveal';
import { SneakerArt } from '@/components/ui/SneakerArt';
import { paletteFor } from '@/lib/sneaker/palette';

export interface DropTeaserItem {
  id: string;
  status: 'upcoming' | 'live' | 'sold_out';
  releaseAt: string; // ISO
  brand: string;
  model: string;
  colorway: string;
  retailPrice: string | null;
  currency: string;
}

function useCountdown(iso: string) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now == null) return null;
  const diff = Math.max(0, new Date(iso).getTime() - now);
  return {
    d: Math.floor(diff / 86_400_000),
    h: Math.floor((diff / 3_600_000) % 24),
    m: Math.floor((diff / 60_000) % 60),
    s: Math.floor((diff / 1000) % 60),
    done: diff === 0,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

function Countdown({ iso }: { iso: string }) {
  const c = useCountdown(iso);
  if (!c) return <div className="h-12" aria-hidden />;
  if (c.done) return <p className="font-mono text-ui-label text-signal">Releasing now</p>;
  const cells = [
    ['D', c.d],
    ['H', c.h],
    ['M', c.m],
    ['S', c.s],
  ] as const;
  return (
    <div role="timer" aria-label={`Time until release: ${c.d} days ${c.h} hours ${c.m} minutes`} className="flex gap-1.5">
      {cells.map(([l, v]) => (
        <div key={l} className="min-w-[3rem] border border-text/12 bg-vault-deep/70 px-2 py-1.5 text-center">
          <span className="block font-mono text-lg font-medium leading-none text-text">{pad(v)}</span>
          <span className="mt-1 block font-mono text-[0.55rem] tracking-[0.2em] text-text-faint">{l}</span>
        </div>
      ))}
    </div>
  );
}

export function DropsTeaser({ drops }: { drops: DropTeaserItem[] }) {
  if (drops.length === 0) return null;
  return (
    <section data-stage="drops" className="relative py-24 sm:py-32" aria-labelledby="drops-h">
      <div className="mx-auto max-w-[90rem] px-5 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Reveal>
              <p className="eyebrow flex items-center gap-2">
                <span className="live-dot text-rust" aria-hidden /> Drop calendar
              </p>
            </Reveal>
            <Reveal delay={0.06}>
              <h2 id="drops-h" className="mt-3 font-display text-[clamp(2.2rem,5vw,3.75rem)] font-bold leading-[1] tracking-tight text-text">
                Never miss a release
              </h2>
            </Reveal>
          </div>
          <Reveal delay={0.1}>
            <Link href="/drops" className="link-underline group inline-flex items-center gap-2 font-sans text-ui-label font-semibold text-text">
              Full calendar <ArrowRight className="h-4 w-4 text-brass transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          </Reveal>
        </div>

        <ul className="mt-12 grid gap-5 lg:grid-cols-3">
          {drops.slice(0, 3).map((d, i) => {
            const p = paletteFor(d.colorway, d.brand);
            return (
              <Reveal as="li" key={d.id} delay={i * 0.08}>
                <Link href={`/drops/${d.id}`} className="edge-glow ticks panel group relative flex h-full flex-col overflow-hidden transition-colors hover:bg-vault-high">
                  <div className="relative h-44 overflow-hidden bg-vault-deep/70">
                    <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(60% 70% at 50% 65%, ${p.glow}50, transparent 75%)` }} />
                    <SneakerArt colorway={d.colorway} brand={d.brand} palette={p} className="absolute inset-0 m-auto h-[85%] w-[85%] transition-transform duration-500 group-hover:-rotate-3 group-hover:scale-105" />
                    <span className={`absolute left-3 top-3 inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[0.65rem] font-semibold uppercase tracking-wider ${d.status === 'live' ? 'border-signal/50 bg-signal/10 text-signal' : 'border-brass/50 bg-brass/10 text-brass-bright'}`}>
                      {d.status === 'live' && <span className="live-dot !h-1.5 !w-1.5" aria-hidden />}
                      {d.status === 'live' ? 'Live now' : 'Upcoming'}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-4 p-5">
                    <div>
                      <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-brass">{d.brand}</p>
                      <h3 className="mt-1 font-display text-2xl font-semibold leading-tight text-text">{d.model}</h3>
                      <p className="text-meta text-text-soft">{d.colorway}</p>
                    </div>
                    <div className="mt-auto flex items-end justify-between gap-3">
                      <Countdown iso={d.releaseAt} />
                      <span className="flex items-center gap-1.5 font-mono text-meta text-text-faint">
                        <BellRing className="h-3.5 w-3.5 text-brass" aria-hidden />
                        {d.retailPrice ? `${d.currency === 'INR' ? '₹' : d.currency + ' '}${new Intl.NumberFormat('en-IN').format(Number(d.retailPrice))}` : 'TBA'}
                      </span>
                    </div>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
