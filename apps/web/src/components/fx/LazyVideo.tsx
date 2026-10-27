'use client';

import { useEffect, useRef, useState } from 'react';

export interface LazyVideoSource {
  src: string;
  type: string;
  media?: string;
}

/**
 * A muted looping background video that costs nothing until it is near the screen: no file is fetched, nothing decodes, and the poster
 * shows. It starts when the video is within ~300px of the viewport and pauses when it leaves. With reduced motion it stays on the poster.
 */
export function LazyVideo({
  sources,
  poster,
  className,
  ariaLabel,
}: {
  sources: LazyVideoSource[];
  poster: string;
  className?: string;
  /** Omit for a decorative video (it is then hidden from screen readers). */
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          setArmed(true);
          v.play().catch(() => {
            /* autoplay blocked: the poster stays */
          });
        } else {
          v.pause();
        }
      },
      { rootMargin: '300px 0px' },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  // Sources are added only once the video is near the screen; load() makes the browser pick one.
  useEffect(() => {
    if (armed) {
      const v = ref.current;
      v?.load();
      v?.play().catch(() => {});
    }
  }, [armed]);

  return (
    <video
      ref={ref}
      className={className}
      muted
      loop
      playsInline
      preload="none"
      poster={poster}
      {...(ariaLabel ? { 'aria-label': ariaLabel } : { 'aria-hidden': true })}
    >
      {armed && sources.map((s) => <source key={s.src} src={s.src} type={s.type} media={s.media} />)}
    </video>
  );
}
