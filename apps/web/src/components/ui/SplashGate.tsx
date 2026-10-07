'use client';

import { useEffect, useState } from 'react';
import { BrandLoader } from './BrandLoader';

/** How long the opening loader stays up, so the brand moment is never a flash. */
const SPLASH_MS = 3500;

/**
 * First-load splash. It is in the server-rendered HTML (so it is visible
 * before any JS runs), holds for SPLASH_MS, then fades out and unmounts.
 */
export function SplashGate() {
  const [phase, setPhase] = useState<'show' | 'fade' | 'gone'>('show');

  useEffect(() => {
    document.documentElement.style.overflow = 'hidden';
    const fade = window.setTimeout(() => setPhase('fade'), SPLASH_MS);
    const gone = window.setTimeout(() => {
      setPhase('gone');
      document.documentElement.style.overflow = '';
    }, SPLASH_MS + 600);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(gone);
      document.documentElement.style.overflow = '';
    };
  }, []);

  if (phase === 'gone') return null;
  return (
    <div className={`transition-opacity duration-500 ${phase === 'fade' ? 'opacity-0' : 'opacity-100'}`} aria-hidden={phase === 'fade'}>
      <BrandLoader />
    </div>
  );
}
