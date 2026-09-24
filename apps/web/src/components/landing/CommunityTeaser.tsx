'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Flame, MessageSquare, ShieldCheck, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Reveal } from '@/components/fx/Reveal';
import { SneakerArt } from '@/components/ui/SneakerArt';
import { paletteFor } from '@/lib/sneaker/palette';

export interface CopDropItem {
  brand: string;
  model: string;
  colorway: string;
  price: string;
}

const FEATURES = [
  { icon: Flame, title: 'Cop or Drop', body: 'Put any pair to a vote and see where the community lands before you spend.' },
  { icon: MessageSquare, title: 'Price checks & drop talk', body: 'Ask if a price is fair, or trade notes live in chat rooms that open with every drop.' },
  { icon: ShieldCheck, title: 'Legit checks', body: 'Post photos, follow the checklist, get a second pair of eyes — moderated and reputation-weighted.' },
];

/** Interactive Cop-or-Drop demo (local state only) + community pillars. */
export function CommunityTeaser({ pairs }: { pairs: CopDropItem[] }) {
  const [i, setI] = useState(0);
  const [votes, setVotes] = useState<Record<number, 'cop' | 'drop'>>({});
  const pair = pairs[i % Math.max(pairs.length, 1)];
  const chosen = votes[i];
  const p = pair ? paletteFor(pair.colorway, pair.brand) : null;
  // stable, deterministic "community split" for the demo
  const split = pair ? 40 + ((pair.model.length * 7 + pair.colorway.length * 3) % 45) : 50;

  return (
    <section data-stage="community" className="relative py-24 sm:py-32" aria-labelledby="community-h">
      <div className="mx-auto max-w-[90rem] px-5 sm:px-8">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div>
            <Reveal>
              <p className="eyebrow">Community</p>
            </Reveal>
            <Reveal delay={0.06}>
              <h2 id="community-h" className="mt-3 font-display text-[clamp(2.2rem,5vw,3.75rem)] font-bold leading-[1] tracking-tight text-text">
                Kicks are better <span className="text-brass-gradient">with people.</span>
              </h2>
            </Reveal>
            <ul className="mt-9 space-y-6">
              {FEATURES.map((f, k) => {
                const Icon = f.icon;
                return (
                  <Reveal as="li" key={f.title} delay={0.1 + k * 0.07}>
                    <div className="flex gap-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-brass/30 bg-brass/[0.07] text-brass-bright">
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <div>
                        <h3 className="font-display text-xl font-semibold text-text">{f.title}</h3>
                        <p className="mt-1 max-w-md text-text-soft">{f.body}</p>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </ul>
            <Reveal delay={0.35}>
              <Link href="/community" className="link-underline group mt-9 inline-flex items-center gap-2 font-sans text-ui-label font-semibold text-text">
                Enter the community <ArrowRight className="h-4 w-4 text-brass transition-transform group-hover:translate-x-1" aria-hidden />
              </Link>
            </Reveal>
          </div>

          {pair && p && (
            <Reveal delay={0.1}>
              <div className="panel edge-glow ticks relative mx-auto w-full max-w-md overflow-hidden">
                <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(70% 55% at 50% 35%, ${p.glow}40, transparent 75%)` }} />
                <div className="relative p-6">
                  <div className="flex items-center justify-between font-mono text-[0.65rem] uppercase tracking-[0.2em] text-text-faint">
                    <span>Cop or Drop</span>
                    <span>
                      {(i % pairs.length) + 1} / {pairs.length}
                    </span>
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 30, rotate: 2 }}
                      animate={{ opacity: 1, x: 0, rotate: 0 }}
                      exit={{ opacity: 0, x: -30, rotate: -2 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <SneakerArt colorway={pair.colorway} brand={pair.brand} palette={p} className="mx-auto mt-4 h-40 w-full" />
                      <p className="mt-2 text-center font-mono text-[0.65rem] uppercase tracking-[0.18em] text-brass">{pair.brand}</p>
                      <h3 className="text-center font-display text-2xl font-semibold text-text">{pair.model}</h3>
                      <p className="text-center text-meta text-text-soft">
                        {pair.colorway} · <span className="font-mono text-text">{pair.price}</span>
                      </p>
                    </motion.div>
                  </AnimatePresence>

                  {chosen ? (
                    <div className="mt-6">
                      <div className="flex h-10 overflow-hidden border border-text/15" role="img" aria-label={`Community: ${split}% cop, ${100 - split}% drop`}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${split}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="flex items-center bg-signal/20 pl-3 font-mono text-meta font-semibold text-signal">
                          COP {split}%
                        </motion.div>
                        <div className="flex flex-1 items-center justify-end bg-rust/15 pr-3 font-mono text-meta font-semibold text-rust">DROP {100 - split}%</div>
                      </div>
                      <button type="button" onClick={() => setI((n) => n + 1)} className="mt-4 w-full border border-text/15 py-3 font-sans text-ui-label font-semibold text-text transition-colors hover:border-brass hover:text-brass-bright">
                        Next pair →
                      </button>
                    </div>
                  ) : (
                    <div className="mt-6 grid grid-cols-2 gap-3">
                      <button type="button" onClick={() => setVotes((v) => ({ ...v, [i]: 'drop' }))} className="group flex items-center justify-center gap-2 border border-rust/40 bg-rust/[0.07] py-3.5 font-sans text-ui-label font-semibold text-rust transition-all hover:bg-rust/15 hover:shadow-glow-rust">
                        <ThumbsDown className="h-4 w-4 transition-transform group-hover:-rotate-12" aria-hidden /> Drop
                      </button>
                      <button type="button" onClick={() => setVotes((v) => ({ ...v, [i]: 'cop' }))} className="group flex items-center justify-center gap-2 border border-signal/40 bg-signal/[0.07] py-3.5 font-sans text-ui-label font-semibold text-signal transition-all hover:bg-signal/15 hover:shadow-glow-signal">
                        <ThumbsUp className="h-4 w-4 transition-transform group-hover:rotate-12" aria-hidden /> Cop
                      </button>
                    </div>
                  )}
                  <p className="mt-4 text-center font-mono text-[0.6rem] text-text-faint">Interactive preview — real voting lives in the community.</p>
                </div>
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}
