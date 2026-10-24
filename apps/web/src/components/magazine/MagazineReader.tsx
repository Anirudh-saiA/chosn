'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { PageFlip } from 'page-flip';
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Maximize2, Minimize2 } from 'lucide-react';
import { pdfUrl, type Issue } from '@/lib/magazine';
import { MagazinePage } from './Pages';

/**
 * The page-turning reader. The pages are drawn once (hidden), copied into the page-flip engine, and turned by dragging a corner, clicking
 * the edge, the arrow buttons or the arrow keys. Two-page spreads on a wide screen, one page at a time on a phone.
 * The book arrives with a tilt-and-rise, sits centred while it is closed (cover or back cover showing) and slides to the middle as it opens.
 * A video's play button turns into the player inside the page.
 */
export function MagazineReader({ issue }: { issue: Issue }) {
  const reduce = useReducedMotion();
  const source = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const flip = useRef<PageFlip | null>(null);
  const [page, setPage] = useState(0);
  const [spread, setSpread] = useState(false);
  const [full, setFull] = useState(false);
  const [ready, setReady] = useState(false);
  const shell = useRef<HTMLDivElement>(null);
  const total = issue.pages.length;

  // The reader fills the whole window; track browser full screen too (also left with the Escape key).
  useEffect(() => {
    const was = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; // the magazine owns the whole screen
    const change = () => setFull(document.fullscreenElement === shell.current);
    document.addEventListener('fullscreenchange', change);
    return () => {
      document.body.style.overflow = was;
      document.removeEventListener('fullscreenchange', change);
    };
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void shell.current?.requestFullscreen?.();
  };

  useEffect(() => {
    const from = source.current;
    const holder = stage.current;
    if (!from || !holder) return;
    // page-flip removes the element it was given when it is destroyed, so it gets its own child, not the React-owned stage.
    const el = document.createElement('div');
    el.style.cssText = 'width:100%;height:100%';
    holder.appendChild(el);
    const pf = new PageFlip(el, {
      width: 600,
      height: 800,
      size: 'stretch',
      minWidth: 240,
      maxWidth: 1400,
      minHeight: 320,
      maxHeight: 1867,
      showCover: true,
      maxShadowOpacity: 0.55,
      flippingTime: 950,
      usePortrait: true,
      startZIndex: 0,
      autoSize: true,
      mobileScrollSupport: false,
      clickEventForward: true,
      useMouseEvents: true,
      swipeDistance: 24,
      showPageCorners: true,
      drawShadow: true,
    });
    pf.loadFromHTML(Array.from(from.children).map((c) => c.cloneNode(true) as HTMLElement));
    pf.on('flip', (e) => setPage(Number(e.data)));
    pf.on('changeOrientation', (e) => setSpread(e.data === 'landscape'));
    setSpread(pf.getOrientation() === 'landscape');
    const settle = window.setTimeout(() => setSpread(pf.getOrientation() === 'landscape'), 150); // the engine knows its layout only after it has measured
    flip.current = pf;
    const shown = window.setTimeout(() => setReady(true), 60);

    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') pf.flipNext();
      if (e.key === 'ArrowLeft') pf.flipPrev();
    };
    // A video page: the play button (copied into the engine, so plain DOM) becomes a YouTube player on click.
    const play = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-yt]');
      if (!btn) return;
      const id = btn.getAttribute('data-yt') ?? '';
      if (!/^[\w-]{11}$/.test(id) || !btn.parentElement) return;
      const frame = document.createElement('iframe');
      frame.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
      frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      frame.allowFullscreen = true;
      frame.title = 'Video';
      frame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0';
      btn.parentElement.replaceChild(frame, btn);
    };
    holder.addEventListener('click', play);
    window.addEventListener('keydown', key);
    return () => {
      window.clearTimeout(settle);
      window.clearTimeout(shown);
      window.removeEventListener('keydown', key);
      holder.removeEventListener('click', play);
      pf.destroy();
      flip.current = null;
    };
  }, []);

  const closed = spread && (page === 0 || page >= total - 1);
  const shift = closed ? (page === 0 ? '-25%' : '25%') : '0%';
  const label = page === 0 ? 'Cover' : page >= total - 1 ? 'Back cover' : spread ? `Pages ${page + 1}-${Math.min(page + 2, total - 1)}` : `Page ${page + 1}`;
  const btn =
    'inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD84A]';

  return (
    <div ref={shell} className="fixed inset-0 z-[45] flex flex-col text-white" style={{ background: '#120609', backgroundImage: 'radial-gradient(70% 60% at 50% 0%, #6d1020 0%, transparent 70%)' }}>
      <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <a href="/magazine" className={btn} aria-label="Back to all issues" title="All issues">
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </a>
          <div className="min-w-0">
            <p className="truncate font-mono text-[0.62rem] uppercase tracking-[0.22em] text-[#FFD84A]">
              {issue.kind === 'daily' ? 'Daily edition' : 'Weekly edition'} · No. {issue.issueNo}
            </p>
            <h1 className="truncate font-display text-xl uppercase leading-none sm:text-2xl">The CHOSN Times</h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={toggleFull} className={btn} aria-label={full ? 'Leave full screen' : 'Full screen'} title={full ? 'Leave full screen' : 'Full screen'}>
            {full ? <Minimize2 className="h-5 w-5" aria-hidden /> : <Maximize2 className="h-5 w-5" aria-hidden />}
          </button>
          <a
            href={pdfUrl(issue.slug)}
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#FFD84A] px-4 font-mono text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[#0A0A0A] transition-colors hover:bg-[#FFC400] ${issue.hasPdf ? '' : 'pointer-events-none opacity-50'}`}
            aria-disabled={!issue.hasPdf}
            title={issue.hasPdf ? 'Download this issue as a PDF' : 'The PDF is still being prepared'}
          >
            <Download className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">{issue.hasPdf ? 'Download PDF' : 'PDF coming'}</span>
          </a>
        </div>
      </header>

      <div className="relative min-h-0 flex-1 px-2 sm:px-6" style={{ perspective: '2600px' }}>
        <motion.div
          className="absolute inset-0 px-2 sm:px-6"
          initial={reduce ? false : { opacity: 0, rotateX: 14, rotateY: -10, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, rotateX: 0, rotateY: 0, y: 0, scale: 1 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="h-full w-full" style={{ transform: `translateX(${shift})`, transition: reduce ? 'none' : 'transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)' }}>
            <div aria-hidden className="pointer-events-none absolute inset-x-[6%] bottom-[2%] h-[8%] rounded-[50%]" style={{ background: 'radial-gradient(closest-side, rgba(0,0,0,0.55), transparent)' }} />
            <div ref={stage} className="relative h-full w-full" aria-label={`${issue.title}, page-turning reader`} />
          </div>
        </motion.div>
      </div>

      {!ready && (
        <p className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center font-mono text-[0.72rem] uppercase tracking-[0.22em] text-white/70" role="status">
          Opening the magazine…
        </p>
      )}

      <footer className="flex shrink-0 items-center justify-center gap-4 px-4 py-3">
        <button type="button" className={btn} aria-label="Previous page" onClick={() => flip.current?.flipPrev()}>
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <span className="min-w-[9rem] text-center font-mono text-[0.72rem] uppercase tracking-[0.18em]" aria-live="polite">
          {label} <span className="opacity-50">of {total}</span>
        </span>
        <button type="button" className={btn} aria-label="Next page" onClick={() => flip.current?.flipNext()}>
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </footer>

      <div ref={source} style={{ display: 'none' }} aria-hidden>
        {issue.pages.map((p, i) => (
          <div key={i}>
            <MagazinePage page={p} n={i + 1} slug={issue.slug} />
          </div>
        ))}
      </div>
    </div>
  );
}
