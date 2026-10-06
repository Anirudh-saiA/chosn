import Link from 'next/link';
import { ArrowRight, Flame, MessageSquare, ShieldCheck } from 'lucide-react';
import { Reveal } from '@/components/fx/Reveal';
import { shoeById, type LandingShoe, type ShoePrice } from './shoes';

/** Shared: a shoe floating on its colour block, with a spotlight disc behind it. */
function ShoeOnColour({ shoe, className = '', size = 'w-[88%]', glass = true }: { shoe: LandingShoe; className?: string; size?: string; glass?: boolean }) {
  return (
    <div className={`relative flex items-center justify-center ${glass ? 'glass-card glass-lift' : ''} ${className}`} style={{ background: shoe.bg, color: shoe.fg }}>
      <div className={`relative aspect-[2/1] ${size}`}>
        <div className="shoe-float absolute inset-0">
          <img
            src={shoe.src}
            alt={shoe.alt}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="h-full w-full select-none object-contain drop-shadow-[0_24px_24px_rgba(0,0,0,0.35)]"
          />
        </div>
      </div>
    </div>
  );
}

const eyebrow = 'font-mono text-[0.72rem] font-bold uppercase tracking-[0.24em]';
const bigTitle = 'font-display text-[clamp(3rem,6vw,5rem)] font-bold leading-[0.95] tracking-[-0.02em] [-webkit-text-stroke:0.022em_currentColor]';

/* ---------------------------------------------------------------- compare tiles */

export function CompareTiles({ ids, prices }: { ids: string[]; prices: Record<string, ShoePrice | null> }) {
  return (
    <section id="compare" data-ambient="dunk" className="mx-auto w-full max-w-[90rem] px-5 py-20 sm:px-8">
      <Reveal>
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b-2 border-text pb-5">
          <div className="flex items-baseline gap-5">
            <span className={`${eyebrow} text-text-soft`}>01 / Live prices</span>
            <h2 className={`${bigTitle} text-text`}>compare.</h2>
          </div>
          <Link href="/sneakers" className="inline-flex items-center gap-2 text-[0.78rem] font-extrabold uppercase tracking-[0.2em] text-text hover:opacity-60">
            View all sneakers <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </Reveal>

      <div className="grid gap-5 md:grid-cols-3">
        {ids.map((id, n) => {
          const s = shoeById(id);
          const p = prices[id];
          return (
            <Reveal key={id} delay={n * 0.08}>
              <Link
                href={`/sneakers?q=${encodeURIComponent(s.keyword)}`}
                className="glass-card group flex h-full flex-col justify-between p-7"
                style={{ background: s.bg, color: s.fg }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`${eyebrow} opacity-80`}>{s.brand}</p>
                    <h3 className="mt-1 font-display text-[2rem] font-bold leading-none tracking-tight [-webkit-text-stroke:0.02em_currentColor]">{s.model}</h3>
                    <p className="mt-2 text-[0.85rem] font-bold opacity-85">{s.colourway}</p>
                  </div>
                  {p?.signal && (
                    <span className="rounded-full bg-white px-3 py-1 font-mono text-[0.68rem] font-extrabold tracking-wider text-[#14213D] shadow-sm">
                      {p.signal === 'buy' ? 'BUY' : 'WAIT'}
                    </span>
                  )}
                </div>

                <div className="relative my-8 aspect-[2/1] w-full">
                  <img
                    src={s.src}
                    alt={s.alt}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="absolute inset-0 h-full w-full select-none object-contain drop-shadow-[0_20px_20px_rgba(0,0,0,0.35)] transition-transform duration-500 group-hover:scale-105"
                  />
                </div>

                <div className="flex items-end justify-between border-t-2 border-current pt-4">
                  <div>
                    <span className="block font-mono text-[0.62rem] font-bold uppercase tracking-[0.2em] opacity-80">Best price</span>
                    <span className={`font-mono font-extrabold leading-tight ${p ? 'text-[1.6rem]' : 'text-[1.05rem]'}`}>{p ? p.price : 'Compare retailers'}</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[0.72rem] font-extrabold uppercase tracking-[0.18em]">
                    Compare <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                  </span>
                </div>
              </Link>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- editorial: image left / text right */

export function CompareEditorial({ shoeId }: { shoeId: string }) {
  const s = shoeById(shoeId);
  const points = [
    'Shipping included in every total',
    'Out-of-stock rows never lead',
    'Deep links to the exact size',
  ];
  return (
    <section data-ambient={s.id} className="mx-auto w-full max-w-[90rem] px-5 py-12 sm:px-8">
      <div className="grid items-stretch gap-8 lg:grid-cols-12">
        <Reveal className="lg:col-span-7">
          <ShoeOnColour shoe={s} className="min-h-[24rem] lg:min-h-[32rem]" />
        </Reveal>
        <div className="flex flex-col justify-center lg:col-span-5 lg:pl-6">
          <Reveal>
            <p className={eyebrow} style={{ color: s.accent }}>
              Why chosn
            </p>
            <h2 className={`${bigTitle} mt-3`} style={{ color: s.accent }}>
              landed price,
              <br />
              not sticker.
            </h2>
            <div className="my-6 h-[3px] w-20" style={{ background: s.accent }} />
            <p className="max-w-md text-[1.05rem] font-bold leading-relaxed text-text-soft">
              Shipping, stock and staleness are folded in, so the cheapest row is the cheapest you will actually pay. One
              dense table, ranked, with a single clear way out to the retailer.
            </p>
            <ul className="mt-7 space-y-3">
              {points.map((t) => (
                <li key={t} className="flex items-start gap-3 text-[0.95rem] font-bold text-text">
                  <span aria-hidden className="mt-[7px] h-2 w-2 shrink-0 rotate-45" style={{ background: s.accent }} />
                  {t}
                </li>
              ))}
            </ul>
            <Link
              href="/sneakers"
              className="btn-shine btn-shine-idle mt-9 inline-block rounded-full px-8 py-3.5 text-[0.72rem] font-extrabold uppercase tracking-[0.2em] text-white shadow-[0_12px_24px_-12px_rgba(0,0,0,0.55)] hover:shadow-[0_18px_30px_-12px_rgba(0,0,0,0.65)]"
              style={{ background: s.accent }}
            >
              Start comparing
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- split band */

export function SplitBand({ shoeId }: { shoeId: string }) {
  const s = shoeById(shoeId);
  return (
    <section data-ambient={s.id} className="mx-auto w-full max-w-[90rem] px-5 py-16 sm:px-8">
      <Reveal>
        <div className="glass-card glass-card-lg grid lg:grid-cols-2">
          <ShoeOnColour shoe={s} glass={false} className="min-h-[22rem] py-10" size="w-[84%]" />
          <div className="flex flex-col justify-center bg-[#E9E5DC] p-10 lg:p-16">
            <p className={eyebrow} style={{ color: s.accent }}>
              Our one rule
            </p>
            <h2 className={`${bigTitle} mt-3`} style={{ color: s.accent }}>
              we never
              <br />
              sell a thing.
            </h2>
            <p className="mt-6 max-w-md text-[1.05rem] font-bold leading-relaxed text-text-soft">
              No stock, no markups, no paid placement. When you click through, you buy from the retailer at the price we
              showed you — we only point the way.
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ---------------------------------------------------------------- community */

const FEATURES = [
  { icon: Flame, title: 'Cop or Drop.', body: 'Put any pair to a vote and see where the community lands before you spend.', tone: '#B3121F' },
  { icon: MessageSquare, title: 'Price checks & drop talk.', body: 'Ask if a price is fair, or trade notes live in chat rooms that open with every drop.', tone: '#0A3FB0' },
  { icon: ShieldCheck, title: 'Legit checks.', body: 'Post photos, follow the checklist, get a second pair of eyes — moderated and reputation-weighted.', tone: '#34430F' },
];

export function CommunityStrip({ ids }: { ids: string[] }) {
  return (
    <section id="community" data-ambient="jordan" className="mx-auto w-full max-w-[90rem] px-5 py-20 sm:px-8">
      <Reveal>
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b-2 border-text pb-5">
          <div className="flex items-baseline gap-5">
            <span className={`${eyebrow} text-text-soft`}>02 / Kicks &amp; people</span>
            <h2 className={`${bigTitle} text-text`}>community.</h2>
          </div>
          <Link href="/community" className="inline-flex items-center gap-2 text-[0.78rem] font-extrabold uppercase tracking-[0.2em] text-text hover:opacity-60">
            Enter the community <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </Reveal>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {ids.map((id, n) => {
          const s = shoeById(id);
          return (
            <Reveal key={id} delay={n * 0.06}>
              <div className="glass-card glass-card-sm glass-lift flex aspect-square flex-col justify-between p-5" style={{ background: s.bg, color: s.fg }}>
                <span className="font-mono text-[0.62rem] font-extrabold uppercase tracking-[0.2em] opacity-85">{s.brand}</span>
                <div className="relative mx-auto my-auto aspect-[2/1] w-[96%]">
                  <img
                    src={s.src}
                    alt={s.alt}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="absolute inset-0 h-full w-full select-none object-contain drop-shadow-[0_14px_14px_rgba(0,0,0,0.35)]"
                  />
                </div>
                <span className="text-[0.82rem] font-extrabold uppercase leading-tight tracking-wide">{s.model}</span>
              </div>
            </Reveal>
          );
        })}
      </div>

      <div className="mt-14 grid gap-10 border-t-2 border-text pt-10 md:grid-cols-3">
        {FEATURES.map((f, n) => (
          <Reveal key={f.title} delay={n * 0.08}>
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_10px_20px_-10px_rgba(0,0,0,0.5)]" style={{ background: f.tone }}>
                <f.icon className="h-6 w-6" aria-hidden />
              </span>
              <div>
                <h3 className="font-display text-[1.75rem] font-bold leading-none text-text [-webkit-text-stroke:0.02em_currentColor]">{f.title}</h3>
                <p className="mt-2 max-w-xs text-[0.95rem] font-bold leading-relaxed text-text-soft">{f.body}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
