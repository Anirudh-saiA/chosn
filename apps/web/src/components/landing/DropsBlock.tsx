'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Reveal } from '@/components/fx/Reveal';
import { shoeById } from './shoes';

export interface DropItem {
  id: string;
  status: 'upcoming' | 'live' | 'sold_out';
  releaseAt: string; // ISO
  brand: string;
  model: string;
  colourway: string;
  retailPrice: string | null;
  currency: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

function Countdown({ iso, colour }: { iso: string; colour: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  if (now == null) return <span className="inline-block h-6 w-32" aria-hidden />;
  const diff = Math.max(0, new Date(iso).getTime() - now);
  if (diff === 0) return <span className="font-mono text-[0.8rem] font-extrabold" style={{ color: colour }}>RELEASING NOW</span>;
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff / 3_600_000) % 24);
  const m = Math.floor((diff / 60_000) % 60);
  const s = Math.floor((diff / 1000) % 60);
  return (
    <span role="timer" className="font-mono text-[0.85rem] font-extrabold tracking-wider" style={{ color: colour }}>
      {pad(d)}D : {pad(h)}H : {pad(m)}M : {pad(s)}S
    </span>
  );
}

const date = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' });

/** Editorial block, mirrored: the real drop calendar on the left, a bold colour panel on the right. */
export function DropsBlock({ drops, shoeId }: { drops: DropItem[]; shoeId: string }) {
  const s = shoeById(shoeId);
  const list = drops.slice(0, 3);
  return (
    <section id="drops" data-ambient={s.id} className="mx-auto w-full max-w-[90rem] px-5 py-12 sm:px-8">
      <div className="grid items-stretch gap-8 lg:grid-cols-12">
        <div className="order-2 flex flex-col justify-center lg:order-1 lg:col-span-5 lg:pr-6">
          <Reveal>
            <p className="font-mono text-[0.72rem] font-bold uppercase tracking-[0.24em]" style={{ color: s.accent }}>
              Upcoming drops
            </p>
            <h2 className="mt-3 font-display text-[clamp(3rem,6vw,5rem)] font-bold leading-[0.95] tracking-[-0.02em] [-webkit-text-stroke:0.022em_currentColor]" style={{ color: s.accent }}>
              drops.
            </h2>
            <div className="my-6 h-[3px] w-20" style={{ background: s.accent }} />
            <p className="max-w-md text-[1.05rem] font-bold leading-relaxed text-text-soft">
              Every confirmed release on the calendar, with a live countdown — so you know the minute it opens.
            </p>

            <div className="mt-8 space-y-3">
              {list.length === 0 ? (
                <p className="glass-frost rounded-2xl p-5 text-[0.95rem] font-bold text-text-soft">
                  No drops on the calendar right now — check back soon.
                </p>
              ) : (
                list.map((d) => (
                  <div key={d.id} className="glass-frost flex items-center justify-between gap-4 rounded-2xl p-4">
                    <div className="min-w-0">
                      <span className="block font-mono text-[0.65rem] font-extrabold uppercase tracking-wider" style={{ color: s.accent }}>
                        {date(d.releaseAt)}
                      </span>
                      <span className="block truncate font-sans text-[0.98rem] font-extrabold text-text">
                        {d.brand} {d.model}
                      </span>
                      <span className="block truncate text-[0.78rem] font-semibold text-text-soft">{d.colourway}</span>
                    </div>
                    <div className="shrink-0 text-right">
                      {d.retailPrice && (
                        <span className="block font-mono text-[0.95rem] font-extrabold text-text">
                          {d.currency === 'INR' ? '₹' : `${d.currency} `}
                          {Number(d.retailPrice).toLocaleString('en-IN')}
                        </span>
                      )}
                      <Countdown iso={d.releaseAt} colour={s.accent} />
                    </div>
                  </div>
                ))
              )}
            </div>

            <Link href="/drops" className="mt-8 inline-flex items-center gap-2 text-[0.78rem] font-extrabold uppercase tracking-[0.2em] hover:opacity-60" style={{ color: s.accent }}>
              Full drop calendar <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Reveal>
        </div>

        <Reveal className="order-1 lg:order-2 lg:col-span-7">
          <div className="glass-card glass-lift relative flex min-h-[24rem] items-center justify-center lg:min-h-[32rem]" style={{ background: s.bg }}>
            <div className="relative aspect-[2/1] w-[88%]">
              <div className="shoe-float absolute inset-0">
                <img
                  src={s.src}
                  alt={s.alt}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="h-full w-full select-none object-contain drop-shadow-[0_24px_24px_rgba(0,0,0,0.35)]"
                />
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
