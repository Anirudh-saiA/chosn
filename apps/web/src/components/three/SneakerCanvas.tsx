'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { SneakerArt } from '@/components/ui/SneakerArt';
import type { SneakerPalette } from '@/lib/sneaker/palette';
import type { Pose } from './SneakerStage';

/**
 * Mounts the WebGL sneaker stage. The three.js bundle is dynamically
 * imported so it never blocks first paint; if WebGL is unavailable (or
 * anything throws) the flat SneakerArt is shown instead.
 */
export function SneakerCanvas({
  palette,
  colorway = '',
  mode = 'viewer',
  poses,
  className = '',
  label,
}: {
  palette: SneakerPalette;
  colorway?: string;
  mode?: 'landing' | 'viewer';
  poses?: Pose[];
  className?: string;
  label?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    let stage: { dispose: () => void } | undefined;
    let cancelled = false;

    (async () => {
      try {
        const test = document.createElement('canvas');
        if (!(test.getContext('webgl2') || test.getContext('webgl'))) throw new Error('no webgl');
        const { SneakerStage } = await import('./SneakerStage');
        if (cancelled) return;
        stage = new SneakerStage({ canvas, container, palette, mode, reducedMotion: !!reduce, poses });
        setReady(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      stage?.dispose();
    };
    // palette / poses are stable per mount by design
  }, [reduce, mode, palette.upper, palette.accent, palette.sole]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {failed ? (
        <div className="flex h-full w-full items-center justify-center p-6">
          <SneakerArt colorway={colorway} palette={palette} title={label} className="w-full max-w-xl" />
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={label ?? 'Interactive 3D sneaker'}
          className={`h-full w-full touch-pan-y transition-opacity duration-1000 ${ready ? 'opacity-100' : 'opacity-0'} ${mode === 'viewer' ? 'cursor-grab active:cursor-grabbing' : ''}`}
        />
      )}
    </div>
  );
}
