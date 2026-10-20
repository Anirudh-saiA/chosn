'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';

type Kind = 'drops' | 'news';
type View = 'gate' | Kind;

const MERGE_MS = 700; // the chosen half grows to the middle
const SPLIT_MS = 1000; // then it opens along a horizontal seam
const EASE = [0.76, 0, 0.24, 1] as const;
const GATE_H = 'calc(100svh - 4rem)'; // the whole window under the 4rem header

const LOOK: Record<Kind, { bg: string; fg: string; title: string; sub: string; hover: string }> = {
  drops: { bg: '#14213D', fg: '#FFFFFF', title: 'Drops', sub: 'Calendar, upcoming releases and new arrivals', hover: '#1B2C52' },
  news: { bg: '#0A0A0A', fg: '#FFFFFF', title: 'News', sub: 'Stories, reports and what just went live', hover: '#1A1A1A' },
};

const fromUrl = (): View => {
  const t = new URLSearchParams(window.location.search).get('tab');
  return t === 'drops' || t === 'landed' ? 'drops' : t === 'news' ? 'news' : 'gate';
};

function Title({ kind }: { kind: Kind }) {
  const l = LOOK[kind];
  return (
    <span className="pointer-events-none flex flex-col items-center px-4 text-center" style={{ color: l.fg }}>
      <span className="font-display text-[clamp(4.5rem,15vw,14rem)] uppercase leading-[0.85] tracking-[0.01em]">{l.title}</span>
      <span className="mt-4 max-w-[22rem] font-mono text-[0.72rem] font-bold uppercase tracking-[0.2em] opacity-70">{l.sub}</span>
    </span>
  );
}

/**
 * Releases landing: Drops on the left, News on the right, both in huge type. Choosing one slides it to the middle, then it opens along a
 * horizontal seam (top half up, bottom half down) to reveal its section. Both sections are rendered by the server and passed in, so
 * opening one needs no extra loading.
 */
export function ReleasesExperience({ initial, drops, news, footer }: { initial: View; drops: ReactNode; news: ReactNode; footer?: ReactNode }) {
  const reduce = useReducedMotion();
  const [view, setView] = useState<View>(initial);
  const [opening, setOpening] = useState<{ kind: Kind; phase: 'merge' | 'split' } | null>(null);
  const [mobile, setMobile] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener('change', on);
    const pop = () => setView(fromUrl());
    window.addEventListener('popstate', pop);
    return () => {
      mq.removeEventListener('change', on);
      window.removeEventListener('popstate', pop);
      timers.current.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const go = useCallback((v: View) => {
    window.history.pushState(null, '', v === 'gate' ? '/releases' : `/releases?tab=${v}`);
    setView(v);
    window.scrollTo({ top: 0 });
  }, []);

  const open = (kind: Kind) => {
    if (reduce) return go(kind);
    window.scrollTo({ top: 0 });
    setOpening({ kind, phase: 'merge' });
    timers.current.push(
      window.setTimeout(() => setOpening({ kind, phase: 'split' }), MERGE_MS),
      window.setTimeout(() => {
        window.history.pushState(null, '', `/releases?tab=${kind}`);
        setView(kind);
        setOpening(null);
      }, MERGE_MS + SPLIT_MS),
    );
  };

  const underneath: View = opening ? opening.kind : view; // what is (or will be) shown behind the gate
  const showGate = view === 'gate' || opening !== null;

  return (
    <div className="relative" style={opening ? { height: GATE_H, overflow: 'hidden' } : undefined}>
      <h1 className="sr-only">Releases and news</h1>

      {/* The opened section */}
      {underneath !== 'gate' ? (
        <div className={`mx-auto w-full max-w-[80rem] px-5 py-10 sm:px-8 lg:py-14 ${opening ? 'absolute inset-x-0 top-0 h-full overflow-hidden' : ''}`}>
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b-2 border-[#0A0A0A] pb-5">
            <button type="button" onClick={() => go('gate')} className="inline-flex items-center gap-2 font-mono text-[0.72rem] font-bold uppercase tracking-[0.16em] text-text hover:opacity-60">
              <ArrowLeft className="h-4 w-4" aria-hidden /> Releases
            </button>
            <div role="tablist" aria-label="Section" className="inline-flex overflow-hidden rounded-full border border-[#14213D]">
              {(['drops', 'news'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={view === k}
                  onClick={() => go(k)}
                  className={`px-6 py-2 font-display text-lg uppercase tracking-[0.06em] ${view === k ? 'bg-[#14213D] text-white' : 'bg-white text-[#14213D] hover:bg-[#EAF3FA]'}`}
                >
                  {LOOK[k].title}
                </button>
              ))}
            </div>
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={underneath} initial={{ opacity: 0, y: reduce ? 0 : 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
              {underneath === 'drops' ? drops : news}
            </motion.div>
          </AnimatePresence>
        </div>
      ) : null}

      {/* The gate: two huge halves, then the chosen one merges to the middle and splits open */}
      {showGate ? (
        <div className={opening ? 'absolute inset-0 z-10' : ''} style={{ height: opening ? undefined : GATE_H }}>
          {!opening || opening.phase === 'merge' ? (
            <motion.div
              className="grid h-full min-h-[28rem] overflow-hidden"
              initial={false}
              animate={
                opening
                  ? mobile
                    ? { gridTemplateRows: opening.kind === 'drops' ? '1fr 0fr' : '0fr 1fr' }
                    : { gridTemplateColumns: opening.kind === 'drops' ? '1fr 0fr' : '0fr 1fr' }
                  : mobile
                    ? { gridTemplateRows: '1fr 1fr' }
                    : { gridTemplateColumns: '1fr 1fr' }
              }
              transition={{ duration: MERGE_MS / 1000, ease: EASE }}
            >
              {(['drops', 'news'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  disabled={opening !== null}
                  onClick={() => open(k)}
                  aria-label={`Open ${LOOK[k].title}`}
                  className="group relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden transition-colors duration-300"
                  style={{ background: LOOK[k].bg }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = LOOK[k].hover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = LOOK[k].bg)}
                >
                  <span className="flex w-full min-w-[14rem] items-center justify-center transition-transform duration-500 group-hover:scale-[1.03]">
                    <Title kind={k} />
                  </span>
                  <ArrowUpRight className="absolute right-6 top-6 h-8 w-8 text-white opacity-60 transition-all duration-300 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:opacity-100" aria-hidden />
                </button>
              ))}
            </motion.div>
          ) : (
            <div className="relative h-full min-h-[28rem] overflow-hidden" aria-hidden>
              {(['top', 'bottom'] as const).map((half) => (
                <motion.div
                  key={half}
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ background: LOOK[opening.kind].bg, clipPath: half === 'top' ? 'inset(0 0 50% 0)' : 'inset(50% 0 0 0)' }}
                  initial={{ y: 0 }}
                  animate={{ y: half === 'top' ? '-101%' : '101%' }}
                  transition={{ duration: SPLIT_MS / 1000, ease: EASE }}
                >
                  <Title kind={opening.kind} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {!showGate ? footer : null}
    </div>
  );
}
