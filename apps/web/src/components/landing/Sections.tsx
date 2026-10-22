import Link from 'next/link';
import { ArrowRight, Flame, MessageSquare, ShieldCheck } from 'lucide-react';
import { Reveal } from '@/components/fx/Reveal';
import { ScrollHighlight } from './ScrollHighlight';
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
const bigTitle = 'font-display text-[clamp(3rem,6vw,5rem)] font-normal uppercase leading-[0.95] tracking-[0.01em]';

/* ---------------------------------------------------------------- compare tiles */

export function CompareTiles({ ids, prices }: { ids: string[]; prices: Record<string, ShoePrice | null> }) {
  return (
    <section id="compare" data-ambient="dunk" className="mx-auto w-full max-w-[90rem] px-5 py-20 sm:px-8">
      <Reveal>
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b-2 border-[#0A0A0A] pb-5">
          <div>
            <h2 className="sr-only">Compare</h2>
            <p className="max-w-md text-[1.05rem] font-bold leading-relaxed text-text-soft">
              The same sneaker across every retailer, shipping included — so you see what you&apos;ll actually pay.
            </p>
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
                className="glass-card group flex h-full flex-col justify-between p-8"
                style={{ background: s.bg, color: s.fg, ['--r' as string]: '1.25rem' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`${eyebrow} opacity-80`}>{s.brand}</p>
                    <h3 className="mt-1 font-display text-[1.45rem] font-normal uppercase leading-none tracking-[0.01em]">{s.model}</h3>
                    <p className="mt-2 text-[0.85rem] font-bold opacity-85">{s.colourway}</p>
                  </div>
                  {p?.signal && (
                    <span className="rounded-full bg-white px-3 py-1 font-mono text-[0.68rem] font-extrabold tracking-wider text-[#14213D] shadow-sm">
                      {p.signal === 'buy' ? 'BUY' : 'WAIT'}
                    </span>
                  )}
                </div>

                <div className="relative mx-auto my-12 aspect-[2/1] w-[88%]">
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
                    <span className={`font-mono font-extrabold leading-tight ${p ? 'text-[1.7rem]' : 'text-[1.05rem]'}`}>{p ? p.price : 'See live prices'}</span>
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

/* ---------------------------------------------------------------- split band */

export function SplitBand({ shoeId }: { shoeId: string }) {
  const s = shoeById(shoeId);
  return (
    <section data-ambient={s.id} className="mx-auto w-full max-w-[90rem] px-5 py-16 sm:px-8">
      <Reveal>
        <div className="glass-card glass-card-lg grid lg:grid-cols-2">
          <ShoeOnColour shoe={s} glass={false} className="min-h-[22rem] py-10" size="w-[84%]" />
          <div className="flex flex-col justify-center bg-[#F3F3F3] p-10 lg:p-16">
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
  { icon: Flame, title: 'Cop or Drop.', body: 'Put any pair to a vote and see where the community lands before you spend.', tone: '#B3121F', shoe: 'dunk' },
  { icon: MessageSquare, title: 'Price checks & drop talk.', body: 'Ask if a price is fair, or trade notes live in chat rooms that open with every drop.', tone: '#0A3FB0', shoe: 'samba' },
  { icon: ShieldCheck, title: 'Legit checks.', body: 'Post photos, follow the checklist, get a second pair of eyes — moderated and reputation-weighted.', tone: '#34430F', shoe: 'jordan' },
];

/** 03 Connect: highlighted lead line on top; below, three stacked icon cards on the left and a colourful square video on the right, all sized to fit one screen. */
export function CommunityStrip() {
  return (
    <section id="community" data-ambient="jordan" className="mx-auto flex w-full max-w-[90rem] flex-col justify-center px-5 pb-8 pt-20 [--v:min(46vw,calc(100svh-20rem))] sm:px-8 lg:h-svh">
      <Reveal>
        <h2 className="sr-only">Connect</h2>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b-2 border-[#0A0A0A] pb-4">
          <ScrollHighlight
            before="Every drop deserves"
            first="a conversation"
            between=". Talk "
            second="style and sneakers"
            after="with a community that shares your taste."
            textClass="max-w-5xl text-[clamp(1.4rem,2.8vw,2.6rem)] leading-[1.25]"
          />
          <Link
            href="/community"
            className="inline-flex items-center gap-2 rounded-full bg-[#0A0A0A] px-7 py-3.5 font-display text-[1.05rem] uppercase tracking-[0.18em] text-white shadow-[0_14px_30px_-12px_rgba(0,0,0,0.6)] transition-colors hover:bg-[#262626]"
          >
            Community <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </Reveal>

      <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-4 lg:h-[var(--v)]">
          {FEATURES.map((f, n) => (
            <Reveal key={f.title} delay={n * 0.08} className="lg:flex-1">
              <div className="flex h-full items-center gap-5 rounded-3xl border border-[#0A0A0A]/10 bg-white p-5">
                <span className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-2xl text-white" style={{ background: f.tone }}>
                  <f.icon className="h-9 w-9" aria-hidden />
                </span>
                <div>
                  <h3 className="font-display text-[clamp(1.5rem,2.3vw,2.1rem)] font-normal uppercase leading-none text-text">{f.title}</h3>
                  <p className="mt-2 text-[clamp(0.9rem,1.25vw,1.1rem)] font-bold leading-snug text-text-soft">{f.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal>
          {/* square black-and-white video (public/hero/community.*) */}
          <div className="relative mx-auto aspect-square w-full max-w-[28rem] overflow-hidden rounded-[1.75rem] bg-[#d5e4ef] lg:mx-0 lg:h-[var(--v)] lg:w-auto lg:max-w-none">
            <video className="absolute inset-0 h-full w-full object-cover mix-blend-multiply" autoPlay muted loop playsInline preload="metadata" poster="/hero/community-poster.jpg" aria-label="Community video">
              <source src="/hero/community.webm" type="video/webm" />
              <source src="/hero/community.mp4" type="video/mp4" />
            </video>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
