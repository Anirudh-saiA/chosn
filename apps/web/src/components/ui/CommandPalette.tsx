'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, CornerDownLeft, Search } from 'lucide-react';
import { ShoePhoto } from '@/components/ui/ShoePhoto';
import { SneakerArt } from '@/components/ui/SneakerArt';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Hit {
  styleCode: string;
  brand: string;
  model: string;
  colorway: string;
  defaultSize: number;
  currentPrice: number | null;
  bestAvailablePrice: number | null;
  primaryImageUrl: string | null;
}

/** Where the search button is on screen, so the box can grow out of it. */
export interface PaletteOrigin {
  x: number;
  y: number;
}

const EXAMPLES = ['Nike Dunk Low', 'Air Jordan 4', 'New Balance 550', 'Adidas Samba', 'Air Force 1'];

const inr = (n: number) => `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n))}`;

/**
 * Search box, centred on the screen: it grows out of the header's search button over a blurred backdrop,
 * results slide in one after another. ↑ ↓ Enter Esc all work; focus moves to the input and is restored on close.
 */
export function CommandPalette({ open, onClose, origin }: { open: boolean; onClose: () => void; origin?: PaletteOrigin | null }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      lastFocus.current = document.activeElement as HTMLElement | null;
      setQ('');
      setHits([]);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 120);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      lastFocus.current?.focus?.();
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/catalog/search?q=${encodeURIComponent(term)}&limit=8`, { signal: ctrl.signal });
        if (!res.ok) throw new Error();
        const body = await res.json();
        setHits(body.results ?? []);
      } catch {
        if (!ctrl.signal.aborted) setHits([]);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const term = q.trim();
  const seeAll = term.length >= 2 && hits.length > 0 ? 1 : 0; // the row after the hits
  const total = hits.length + seeAll;

  const go = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router],
  );

  const choose = useCallback(
    (i: number) => {
      if (i < hits.length) {
        const h = hits[i]!;
        go(`/sneakers/${encodeURIComponent(h.styleCode)}/${h.defaultSize}`);
      } else if (term) {
        go(`/sneakers?q=${encodeURIComponent(term)}`);
      }
    },
    [hits, go, term],
  );

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (total ? (a + 1) % total : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (total ? (a - 1 + total) % total : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (total > 0) choose(active);
      else if (term) go(`/sneakers?q=${encodeURIComponent(term)}`);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }

  // Start the box at the search button (relative to the screen centre) and let it spring to the middle.
  const from = useMemo(() => {
    if (reduce || !origin || typeof window === 'undefined') return { x: 0, y: -16, scale: 0.97 };
    return { x: origin.x - window.innerWidth / 2, y: origin.y - window.innerHeight / 2, scale: 0.12 };
  }, [open, origin, reduce]);

  const ease = [0.16, 1, 0.3, 1] as const;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.button
            type="button"
            aria-label="Close search"
            className="absolute inset-0 cursor-default rounded-none bg-[#FAFAFA]/70"
            initial={{ backdropFilter: 'blur(0px)' }}
            animate={{ backdropFilter: 'blur(14px)' }}
            exit={{ backdropFilter: 'blur(0px)' }}
            transition={{ duration: 0.35, ease }}
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search CHOSN"
            onKeyDown={onKey}
            layout
            initial={{ opacity: 0, ...from, borderRadius: 999 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1, borderRadius: 28 }}
            exit={{ opacity: 0, ...from, borderRadius: 999 }}
            transition={reduce ? { duration: 0.15 } : { type: 'spring', stiffness: 230, damping: 25, mass: 0.9, opacity: { duration: 0.18 } }}
            className="relative w-full max-w-[40rem] overflow-hidden rounded-[28px] border border-[#0A0A0A]/10 bg-white/95 shadow-[0_40px_120px_-30px_rgba(10,10,10,0.45)] backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 px-5">
              <Search className="h-5 w-5 shrink-0 text-[#0A0A0A]" strokeWidth={2.2} aria-hidden />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setActive(0);
                }}
                placeholder="Search a sneaker, brand or style code…"
                aria-label="Search sneakers"
                autoComplete="off"
                className="h-16 w-full bg-transparent font-sans text-[1.1rem] text-text outline-none placeholder:text-text-faint"
              />
            </div>

            {/* A thin bar that runs while results load */}
            <div className="relative h-px bg-text/10">
              {loading && (
                <motion.span
                  className="absolute inset-y-0 left-0 w-1/3 bg-[#9A5A00]"
                  animate={{ x: ['-100%', '300%'] }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
            </div>

            <div className="max-h-[56vh] overflow-y-auto p-2" data-lenis-prevent>
              {term.length < 2 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.3 }} className="px-3 pb-3 pt-2">
                  <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-text-faint">Popular searches</p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {EXAMPLES.map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => {
                          setQ(ex);
                          inputRef.current?.focus();
                        }}
                        className="rounded-full border border-text/15 px-3.5 py-1.5 text-[0.84rem] text-text-soft transition-colors hover:border-text hover:text-text"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {term.length >= 2 && !loading && hits.length === 0 && (
                <div className="px-3 py-6 text-center">
                  <p className="text-[0.95rem] font-semibold text-text">No sneakers match “{term}”</p>
                  <p className="mt-1 text-[0.82rem] text-text-soft">Check the spelling, or try just the brand or model.</p>
                </div>
              )}

              {hits.map((h, i) => {
                const price = h.bestAvailablePrice ?? h.currentPrice;
                return (
                  <motion.button
                    key={h.styleCode}
                    type="button"
                    initial={reduce ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.03 * i, duration: 0.28, ease }}
                    onClick={() => choose(i)}
                    onMouseEnter={() => setActive(i)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors ${active === i ? 'bg-[#FAFAFA]' : 'hover:bg-text/[0.04]'}`}
                  >
                    <span className="relative flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-text/10">
                      {h.primaryImageUrl ? (
                        <ShoePhoto
                          key={h.primaryImageUrl}
                          src={h.primaryImageUrl}
                          alt=""
                          className="h-full w-full object-contain p-1"
                          fallback={<SneakerArt colorway={h.colorway} brand={h.brand} className="h-9 w-14" shadow={false} />}
                        />
                      ) : (
                        <SneakerArt colorway={h.colorway} brand={h.brand} className="h-9 w-14" shadow={false} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-ui-label font-semibold text-text">
                        {h.brand} {h.model.trim()}
                      </span>
                      <span className="block truncate font-mono text-meta text-text-faint">
                        {h.styleCode} · {h.colorway}
                      </span>
                    </span>
                    {price != null && <span className="font-mono text-data-inline font-semibold text-text">{inr(price)}</span>}
                    {active === i && <CornerDownLeft className="h-3.5 w-3.5 text-[#9A5A00]" aria-hidden />}
                  </motion.button>
                );
              })}

              {seeAll === 1 && (
                <motion.button
                  type="button"
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.03 * hits.length + 0.05 }}
                  onClick={() => choose(hits.length)}
                  onMouseEnter={() => setActive(hits.length)}
                  className={`mt-1 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors ${active === hits.length ? 'bg-[#FAFAFA]' : 'hover:bg-text/[0.04]'}`}
                >
                  <Search className="h-4 w-4 text-[#0A0A0A]" aria-hidden />
                  <span className="flex-1 truncate text-ui-label font-semibold text-text">See all results for “{term}”</span>
                  <ArrowRight className={`h-3.5 w-3.5 transition-opacity ${active === hits.length ? 'text-[#9A5A00] opacity-100' : 'opacity-0'}`} aria-hidden />
                </motion.button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
