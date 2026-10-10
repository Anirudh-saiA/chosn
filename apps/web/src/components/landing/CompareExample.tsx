import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ScrollHighlight } from './ScrollHighlight';
import { ScrollOn } from './ScrollOn';
import { Marquee } from '@/components/fx/Marquee';
import { Reveal } from '@/components/fx/Reveal';

/** The retailers CHOSN reads prices from (mirrors SourcesStrip). */
const RETAILERS = ['Flipkart', 'Myntra', 'Ajio', 'END. Clothing', 'Superkicks', 'VegNonVeg'];

const hand = 'font-[family-name:var(--font-hand)] font-bold';

interface Offer {
  site: string;
  price: string;
  delivery: string;
  legit: number;
  legitNote: string;
}

/* One sneaker, two sites. Figures are illustrative: this is what a CHOSN comparison looks like. */
const SNEAKER = 'Nike Dunk Low · Sail / Team Red';
const A: Offer = { site: 'Flipkart', price: '₹9,295', delivery: 'Sat, 18 Oct', legit: 71, legitNote: 'Third-party marketplace seller' };
const B: Offer = { site: 'Superkicks', price: '₹10,995', delivery: 'Sun, 12 Oct', legit: 98, legitNote: 'Authorised sneaker retailer' };

/** A wobbly hand-drawn arrow (double-headed), drawn as SVG so it reads like a pen doodle. */
function DoodleArrow({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 40" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path pathLength={1} className="doodle-draw" d="M12 22 C 40 10, 62 34, 92 20 S 150 12, 186 21" />
      <path pathLength={1} className="doodle-draw" style={{ transitionDelay: '0.5s' }} d="M26 10 L 10 22 L 28 33" />
      <path pathLength={1} className="doodle-draw" style={{ transitionDelay: '0.7s' }} d="M172 9 L 189 21 L 171 32" />
    </svg>
  );
}

/** A loose hand-drawn ring to circle the better number. */
function DoodleRing() {
  return (
    <svg viewBox="0 0 220 80" fill="none" stroke="#E0740F" strokeWidth="3" strokeLinecap="round" aria-hidden className="pointer-events-none absolute -inset-x-3 -inset-y-2 h-[calc(100%+1rem)] w-[calc(100%+1.5rem)]" preserveAspectRatio="none">
      <path pathLength={1} className="doodle-ring" d="M30 14 C 90 -2, 190 4, 208 36 C 218 62, 120 78, 50 70 C 6 64, -4 30, 34 16 C 60 8, 90 8, 110 10" />
    </svg>
  );
}

function Cell({ site, label, value, sub, best }: { site: string; label: string; value: string; sub?: string; best?: boolean }) {
  return (
    <ScrollOn className="rounded-2xl border border-[#0A0A0A]/10 bg-white/80 px-6 py-5 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.35)] backdrop-blur cmp-cell">
      <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.22em] text-[#0A0A0A]/50">
        <span className="md:hidden">{site} · </span>
        {label}
      </p>
      <p className="relative mt-1 inline-block font-mono text-[1.9rem] font-extrabold leading-tight text-[#0A0A0A]">
        {best && <DoodleRing />}
        <span
          className={`cmp-num ${best ? 'cmp-num-best' : 'cmp-num-dim'}`}
        >
          {value}
        </span>
      </p>
      {sub && <p className="cmp-sub mt-1 text-[0.85rem] font-bold text-text-soft">{sub}</p>}
    </ScrollOn>
  );
}

function Note({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <ScrollOn delay={250} className={`flex flex-col items-center justify-center text-center text-[#E0740F] ${className}`}>
      <p className={`${hand} cmp-note text-[1.7rem] leading-none`}>{children}</p>
      <DoodleArrow className="mt-1 h-8 w-40 max-w-full" />
    </ScrollOn>
  );
}

function Header({ offer }: { offer: Offer }) {
  return (
    <div className="hidden rounded-2xl bg-[#0A0A0A] px-6 py-4 md:block text-center font-display text-[1.7rem] uppercase tracking-[0.02em] text-white">{offer.site}</div>
  );
}

export function CompareExample() {
  const dPrice = '₹1,700 cheaper';
  return (
    <section id="compare" data-ambient="dunk" className="mx-auto w-full max-w-[90rem] px-5 pb-20 pt-10 sm:px-8">
      <Reveal>
        <h2 className="sr-only">Compare</h2>
        <div className="mb-12 flex flex-wrap items-start justify-between gap-8 border-b-2 border-[#0A0A0A] pb-8">
          <ScrollHighlight />

          <div className="flex flex-col items-end gap-4">
            <Link href="/sneakers" className="inline-flex items-center gap-2 text-[0.78rem] font-extrabold uppercase tracking-[0.2em] text-text hover:opacity-60">
              View all sneakers <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </Reveal>

      {/* live-scrolling band of the retailers we compare */}
      <div className="glass-frost mb-14 overflow-hidden rounded-full py-4" aria-label="Retailers we compare">
        <Marquee duration={30} repeat={2}>
          <span className="mx-6 shrink-0 rounded-full bg-text px-3.5 py-1.5 font-mono text-[0.62rem] font-extrabold uppercase tracking-[0.22em] text-[#F4F1EA]">Retailers</span>
          {RETAILERS.map((r) => (
            <span key={r} className="flex shrink-0 items-center">
              <span className="px-8 font-display text-[clamp(1.6rem,3vw,2.4rem)] font-bold leading-none tracking-tight text-text">{r}</span>
              <span aria-hidden className="h-1.5 w-1.5 rotate-45 bg-brass" />
            </span>
          ))}
        </Marquee>
      </div>

      <Reveal>
        <div className="mb-6 flex flex-col items-center">
          <img
            src="/images/hero-dunk-syracuse.png"
            alt={`${SNEAKER} (example)`}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="h-auto w-[min(26rem,80vw)] select-none object-contain drop-shadow-[0_24px_24px_rgba(0,0,0,0.3)]"
          />
          <p className="mt-1 font-mono text-[0.6rem] font-bold uppercase tracking-[0.22em] text-[#0A0A0A]/40">Illustrative figures</p>
        </div>

        {/* [site A] [what differs] [site B] — one row per thing worth comparing */}
        <div className="grid items-stretch gap-x-4 gap-y-3 md:grid-cols-[1fr_minmax(11rem,15rem)_1fr]">
          <Header offer={A} />
          <div className="hidden md:block" />
          <Header offer={B} />

          <Cell site={A.site} label="Price" value={A.price} best sub="Cheapest listing" />
          <Note>{dPrice}</Note>
          <Cell site={B.site} label="Price" value={B.price} sub="Pays for faster, safer" />

          <Cell site={A.site} label="Delivery" value={A.delivery} sub="Standard shipping" />
          <Note>6 days faster →</Note>
          <Cell site={B.site} label="Delivery" value={B.delivery} best sub="Express included" />

          <Cell site={A.site} label="How legit is the order" value={`${A.legit}/100`} sub={A.legitNote} />
          <Note>+27 trust points</Note>
          <Cell site={B.site} label="How legit is the order" value={`${B.legit}/100`} best sub={B.legitNote} />
        </div>
      </Reveal>
    </section>
  );
}
