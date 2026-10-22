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

const LOOK: Record<Kind, { bg: string; fg: string; title: string; sub: string; hover: string; img: string }> = {
  drops: { bg: '#14213D', fg: '#FFFFFF', title: 'Drops', sub: 'Calendar, upcoming releases and new arrivals', hover: '#1B2C52', img: '/images/drops-shelf.jpg' },
  news: { bg: '#0A0A0A', fg: '#FFFFFF', title: 'News', sub: 'Stories, reports and what just went live', hover: '#1A1A1A', img: '/images/news-stack.jpg' },
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

/** One half's face: its flat colour, a picture behind the word (stand-in for the video to come), and the word. */
function Face({ kind }: { kind: Kind }) {
  const l = LOOK[kind];
  return (
    <span className="absolute inset-0 flex items-center justify-center overflow-hidden" style={{ background: l.bg }}>
      <img src={l.img} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
      <span className={`absolute inset-0 ${kind === 'news' ? 'bg-[#0A0A0A]/70' : 'bg-[#14213D]/75'}`} />
      <span className="relative flex w-full items-center justify-center transition-transform duration-500 group-hover:scale-[1.03]">
        <Title kind={kind} />
      </span>
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
  // One animation at a time. Opening: merge (the chosen half grows to the middle), then split (it opens along a horizontal seam).
  // Closing (Back) is the same thing in reverse: join (the seam closes over the section), then unmerge (it divides back into two halves).
  const [anim, setAnim] = useState<{ dir: 'open' | 'close'; kind: Kind; phase: 'merge' | 'split' | 'join' | 'unmerge' } | null>(null);
  const [mobile, setMobile] = useState(false);
  const timers = useRef<number[]>([]);
  const viewRef = useRef<View>(initial);
  const busy = useRef(false);
  viewRef.current = view;

  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  const close = useCallback(
    (push: boolean) => {
      const kind = viewRef.current;
      if (kind === 'gate' || busy.current) return;
      if (push) window.history.pushState(null, '', '/releases');
      window.scrollTo({ top: 0 });
      if (reduce) return setView('gate');
      busy.current = true;
      setAnim({ dir: 'close', kind, phase: 'join' });
      later(() => setAnim({ dir: 'close', kind, phase: 'unmerge' }), SPLIT_MS);
      later(() => {
        setView('gate');
        setAnim(null);
        busy.current = false;
      }, SPLIT_MS + MERGE_MS);
    },
    [reduce],
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener('change', on);
    // The browser's Back button plays the same closing animation.
    const pop = () => {
      const target = fromUrl();
      if (target === 'gate') close(false);
      else setView(target);
    };
    window.addEventListener('popstate', pop);
    return () => {
      mq.removeEventListener('change', on);
      window.removeEventListener('popstate', pop);
      timers.current.forEach((t) => window.clearTimeout(t));
    };
  }, [close]);

  const swap = (v: Kind) => {
    window.history.pushState(null, '', `/releases?tab=${v}`);
    setView(v);
  };

  const open = (kind: Kind) => {
    if (busy.current) return;
    window.scrollTo({ top: 0 });
    window.history.pushState(null, '', `/releases?tab=${kind}`);
    if (reduce) return setView(kind);
    busy.current = true;
    setAnim({ dir: 'open', kind, phase: 'merge' });
    later(() => setAnim({ dir: 'open', kind, phase: 'split' }), MERGE_MS);
    later(() => {
      setView(kind);
      setAnim(null);
      busy.current = false;
    }, MERGE_MS + SPLIT_MS);
  };

  const underneath: View = anim ? anim.kind : view; // what is (or was) shown behind the gate
  const showGate = view === 'gate' || anim !== null;
  const gridPhase = anim !== null && (anim.phase === 'merge' || anim.phase === 'unmerge');
  const halvesPhase = anim !== null && (anim.phase === 'split' || anim.phase === 'join');
  const side = (k: Kind) => (k === 'drops' ? '1fr 0fr' : '0fr 1fr');
  const merged = anim ? side(anim.kind) : '1fr 1fr';
  const split = '1fr 1fr';
  // grid start / end for the current phase (merge goes 2 halves -> 1; unmerge goes 1 -> 2 halves)
  const from = anim?.phase === 'unmerge' ? merged : split;
  const to = anim?.phase === 'unmerge' ? split : anim ? merged : split;
  const axis = mobile ? 'gridTemplateRows' : 'gridTemplateColumns';

  return (
    <div className="relative" style={anim ? { height: GATE_H, overflow: 'hidden' } : undefined}>
      <h1 className="sr-only">Releases and news</h1>

      {/* The opened section */}
      {underneath !== 'gate' ? (
        <div className={`mx-auto w-full max-w-[80rem] px-5 pb-10 pt-3 sm:px-8 lg:pb-14 lg:pt-4 ${anim ? 'absolute inset-x-0 top-0 h-full overflow-hidden' : ''}`}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#0A0A0A] pb-3">
            <button type="button" onClick={() => close(true)} className="inline-flex items-center gap-2 font-mono text-[0.72rem] font-bold uppercase tracking-[0.16em] text-text hover:opacity-60">
              <ArrowLeft className="h-4 w-4" aria-hidden /> Releases
            </button>
            <div role="tablist" aria-label="Section" className="inline-flex overflow-hidden rounded-full border border-[#14213D]">
              {(['drops', 'news'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={view === k}
                  onClick={() => view !== k && swap(k)}
                  className={`px-6 py-2 font-display text-lg uppercase tracking-[0.06em] ${view === k ? 'bg-[#14213D] text-white' : 'bg-white text-[#14213D] hover:bg-[#EAF3FA]'}`}
                >
                  {LOOK[k].title}
                </button>
              ))}
              <a href="/magazine" className="border-l border-[#14213D] bg-[#C8102E] px-6 py-2 font-display text-lg uppercase tracking-[0.06em] text-white hover:bg-[#A60C24]">
                Magazine
              </a>
            </div>
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={underneath} initial={{ opacity: anim ? 1 : 0, y: reduce || anim ? 0 : 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
              {underneath === 'drops' ? drops : news}
            </motion.div>
          </AnimatePresence>
        </div>
      ) : null}

      {/* The gate: two huge halves. Opening: one merges to the middle and splits open. Closing: the reverse. */}
      {showGate ? (
        <div className={anim ? 'absolute inset-0 z-10' : ''} style={{ height: anim ? undefined : GATE_H }}>
          {!anim || gridPhase ? (
            <motion.div
              key={anim ? anim.phase : 'idle'}
              className="grid h-full min-h-[28rem] overflow-hidden"
              initial={anim ? { [axis]: from } : false}
              animate={{ [axis]: anim ? to : split }}
              transition={{ duration: MERGE_MS / 1000, ease: EASE }}
            >
              {(['drops', 'news'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  disabled={anim !== null}
                  onClick={() => open(k)}
                  aria-label={`Open ${LOOK[k].title}`}
                  className="group relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden transition-colors duration-300"
                  style={{ background: LOOK[k].bg }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = LOOK[k].hover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = LOOK[k].bg)}
                >
                  <Face kind={k} />
                  <ArrowUpRight className="absolute right-6 top-6 h-8 w-8 text-white opacity-60 transition-all duration-300 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:opacity-100" aria-hidden />
                </button>
              ))}
            </motion.div>
          ) : halvesPhase && anim ? (
            <div className="relative h-full min-h-[28rem] overflow-hidden" aria-hidden>
              {(['top', 'bottom'] as const).map((half) => {
                const away = half === 'top' ? '-101%' : '101%';
                const closing = anim.phase === 'join';
                return (
                  <motion.div
                    key={half}
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ background: LOOK[anim.kind].bg, clipPath: half === 'top' ? 'inset(0 0 50% 0)' : 'inset(50% 0 0 0)' }}
                    initial={{ y: closing ? away : 0 }}
                    animate={{ y: closing ? 0 : away }}
                    transition={{ duration: SPLIT_MS / 1000, ease: EASE }}
                  >
                    <Face kind={anim.kind} />
                  </motion.div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {!showGate ? footer : null}
    </div>
  );
}
