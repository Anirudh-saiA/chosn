import { ChevronDown } from 'lucide-react';

/** Hero: full-bleed looping background video, CHOSN wordmark on top, "Scroll down" cue at the bottom. */
export function HeroVideo() {
  return (
    <section data-ambient="hero" className="relative w-full" aria-label="CHOSN">
      <div className="relative flex h-svh min-h-[30rem] w-full items-center justify-center overflow-hidden bg-black">
        <video
          className="absolute inset-0 h-full w-full object-cover"
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

        <a
          href="#after-hero"
          className="hero-cue absolute inset-x-0 bottom-6 z-10 flex flex-col items-center gap-1 font-sans text-[0.72rem] font-bold uppercase tracking-[0.3em] text-white/90 transition-opacity hover:text-white"
        >
          Scroll down
          <ChevronDown className="h-5 w-5 animate-bounce" aria-hidden />
        </a>
      </div>
      <div id="after-hero" className="absolute -bottom-0 h-0 scroll-mt-16" />
    </section>
  );
}
