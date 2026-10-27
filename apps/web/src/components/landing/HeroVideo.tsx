'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/** Hero: full-bleed looping background video, CHOSN wordmark on top, "Scroll down" cue at the bottom. */
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  // The poster photo is on screen from the first paint; the video fades in over it once it is really playing, so there is no black flash or jump.
  useEffect(() => {
    const v = ref.current;
    // Reduced motion: no moving background. Stop the video and leave the poster photo showing.
    if (v && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      v.pause();
      v.removeAttribute('autoplay');
      return;
    }
    if (v && !v.paused && v.readyState >= 3) setReady(true);
  }, []);
  return (
    <section data-ambient="hero" className="relative w-full" aria-label="CHOSN">
      <div className="relative flex h-svh min-h-[30rem] w-full flex-col items-center justify-center overflow-hidden bg-black">
        <img src="/hero/hero-poster.jpg" alt="" aria-hidden fetchPriority="high" decoding="async" className="hero-poster absolute inset-0 h-full w-full object-cover" />
        <video
          ref={ref}
          data-ready={ready}
          onPlaying={() => {
            if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) setReady(true);
          }}
          className="hero-video absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster="/hero/hero-poster.jpg"
          aria-hidden
        >
          <source src="/hero/hero-bg-720p-mobile.webm" type="video/webm" media="(max-width: 767px)" />
          <source src="/hero/hero-bg-720p-mobile.mp4" type="video/mp4" media="(max-width: 767px)" />
          <source src="/hero/hero-bg-1080p.webm" type="video/webm" />
          <source src="/hero/hero-bg-1080p.mp4" type="video/mp4" />
        </video>
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/45" />

        <h1 className="hero-wordmark relative z-10 text-center font-display text-[clamp(5rem,20vw,18rem)] uppercase leading-none tracking-[0.02em] text-white [text-shadow:0_4px_40px_rgba(0,0,0,0.35)]">
          Chosn
        </h1>

        {/* tagline: each line slides up out of a mask once the wordmark has landed */}
        <p className="hero-tagline relative z-10 mt-[clamp(1rem,3vw,2.25rem)] px-6 text-center font-sans text-[clamp(1.05rem,2.4vw,2rem)] font-bold leading-snug tracking-tight text-[#FF7A1A] [text-shadow:0_2px_24px_rgba(0,0,0,0.5)]">
          <span className="hero-line block overflow-hidden">
            <span className="block" style={{ ['--d' as string]: '0.9s' }}>&ldquo;You don&apos;t join <span className="text-white">CHOSN</span>.</span>
          </span>
          <span className="hero-line block overflow-hidden">
            <span className="block" style={{ ['--d' as string]: '1.1s' }}>You belong here.&rdquo;</span>
          </span>
        </p>

        <a
          href="#after-hero"
          className="hero-cue absolute inset-x-0 bottom-3 z-10 flex min-h-11 flex-col items-center justify-center gap-1 font-sans text-[0.72rem] font-bold uppercase tracking-[0.3em] text-white/90 transition-opacity hover:text-white"
        >
          Scroll down
          <ChevronDown className="h-5 w-5 animate-bounce" aria-hidden />
        </a>
      </div>
      <div id="after-hero" className="absolute -bottom-0 h-0 scroll-mt-16" />
    </section>
  );
}
