'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CornerDownLeft, Search, Sparkles, Newspaper, Flame, Users, Bell } from 'lucide-react';
import { SneakerArt } from '@/components/ui/SneakerArt';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Hit {
  styleCode: string;
  brand: string;
  model: string;
  colorway: string;
  defaultSize: number;
  currentPrice: number | null;
}

const LINKS = [
  { label: 'Search sneakers', href: '/sneakers', icon: Search },
  { label: 'Upcoming drops', href: '/drops', icon: Flame },
  { label: 'News', href: '/news', icon: Newspaper },
  { label: 'Community', href: '/community', icon: Users },
  { label: 'Notifications', href: '/notifications', icon: Bell },
];

const inr = (n: number) => `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n))}`;

/**
 * ⌘K / Ctrl+K / "/" palette: jump anywhere or search the live catalog.
 * Fully keyboard operable (↑ ↓ Enter Esc), focus-trapped by the modal
 * pattern (aria-modal, focus moves to the input, restored on close).
 */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
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
      setTimeout(() => inputRef.current?.focus(), 30);
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
        const res = await fetch(`${API_URL}/catalog/search?q=${encodeURIComponent(term)}&limit=6`, { signal: ctrl.signal });
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

  const links = useMemo(
    () => (q.trim() ? LINKS.filter((l) => l.label.toLowerCase().includes(q.trim().toLowerCase())) : LINKS),
    [q],
  );
  const total = hits.length + links.length;

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
      } else if (links[i - hits.length]) {
        go(links[i - hits.length]!.href);
      } else if (q.trim()) {
        go(`/sneakers?q=${encodeURIComponent(q.trim())}`);
      }
    },
    [hits, links, go, q],
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
      if (total === 0 && q.trim()) go(`/sneakers?q=${encodeURIComponent(q.trim())}`);
      else choose(active);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <button
            type="button"
            aria-label="Close search"
            className="absolute inset-0 cursor-default bg-vault-deep/75 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search CHOSN"
            onKeyDown={onKey}
            initial={{ opacity: 0, y: -14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.985 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            className="glass ticks relative w-full max-w-xl overflow-hidden shadow-lift"
          >
            <div className="flex items-center gap-3 border-b border-text/10 px-4">
              <Search className="h-4 w-4 shrink-0 text-brass" aria-hidden />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setActive(0);
                }}
                placeholder="Search a sneaker, brand or style code…"
                aria-label="Search sneakers"
                className="h-14 w-full bg-transparent font-sans text-body text-text outline-none placeholder:text-text-faint"
              />
              <kbd className="hidden shrink-0 border border-text/15 px-1.5 py-0.5 font-mono text-[0.65rem] text-text-faint sm:block">ESC</kbd>
            </div>

            <div className="max-h-[52vh] overflow-y-auto p-2" data-lenis-prevent>
              {q.trim().length >= 2 && (
                <p className="px-3 pb-1 pt-2 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-text-faint">
                  {loading ? 'Searching…' : hits.length ? 'Sneakers' : 'No sneakers match'}
                </p>
              )}
              {hits.map((h, i) => (
                <button
                  key={h.styleCode}
                  type="button"
                  onClick={() => choose(i)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${active === i ? 'bg-brass/10' : 'hover:bg-text/[0.04]'}`}
                >
                  <span className="flex h-11 w-16 shrink-0 items-center justify-center bg-vault-deep/70">
                    <SneakerArt colorway={h.colorway} brand={h.brand} className="h-9 w-14" shadow={false} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ui-label font-semibold text-text">
                      {h.brand} {h.model}
                    </span>
                    <span className="block truncate font-mono text-meta text-text-faint">
                      {h.styleCode} · {h.colorway}
                    </span>
                  </span>
                  {h.currentPrice != null && <span className="font-mono text-data-inline text-text">{inr(h.currentPrice)}</span>}
                  {active === i && <CornerDownLeft className="h-3.5 w-3.5 text-brass" aria-hidden />}
                </button>
              ))}

              {links.length > 0 && (
                <p className="px-3 pb-1 pt-3 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-text-faint">Go to</p>
              )}
              {links.map((l, j) => {
                const i = hits.length + j;
                const Icon = l.icon;
                return (
                  <button
                    key={l.href}
                    type="button"
                    onClick={() => choose(i)}
                    onMouseEnter={() => setActive(i)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${active === i ? 'bg-brass/10' : 'hover:bg-text/[0.04]'}`}
                  >
                    <Icon className="h-4 w-4 text-text-soft" aria-hidden />
                    <span className="flex-1 text-ui-label text-text">{l.label}</span>
                    <ArrowRight className={`h-3.5 w-3.5 transition-opacity ${active === i ? 'text-brass opacity-100' : 'opacity-0'}`} aria-hidden />
                  </button>
                );
              })}

              {q.trim() && !loading && hits.length === 0 && (
                <button
                  type="button"
                  onClick={() => go(`/sneakers?q=${encodeURIComponent(q.trim())}`)}
                  className="mt-1 flex w-full items-center gap-3 px-3 py-2.5 text-left text-ui-label text-text-soft hover:bg-text/[0.04]"
                >
                  <Sparkles className="h-4 w-4 text-brass" aria-hidden />
                  Search the full catalog for “{q.trim()}”
                </button>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-text/10 px-4 py-2 font-mono text-[0.65rem] text-text-faint">
              <span>↑↓ navigate · ↵ open</span>
              <span>CHOSN</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
