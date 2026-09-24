'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { MousePointer2 } from 'lucide-react';
import { paletteFor } from '@/lib/sneaker/palette';

const SneakerCanvas = dynamic(() => import('@/components/three/SneakerCanvas').then((m) => m.SneakerCanvas), {
  ssr: false,
  loading: () => <div className="skeleton h-full w-full" aria-hidden />,
});

/**
 * Drag-to-rotate 3D sneaker tinted from the colourway. Falls back to
 * flat SneakerArt when WebGL is unavailable. Give it a sized parent
 * (e.g. `h-[360px]`); it fills 100%.
 */
export function SneakerViewer({
  brand,
  model,
  colorway,
  className = '',
}: {
  brand: string;
  model: string;
  colorway: string;
  className?: string;
}) {
  const palette = useMemo(() => paletteFor(colorway, brand), [colorway, brand]);
  return (
    <div className={`relative h-full w-full ${className}`}>
      <SneakerCanvas palette={palette} colorway={colorway} mode="viewer" className="h-full w-full" label={`3D model of ${brand} ${model} in ${colorway}`} />
      <span className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-text-faint">
        <MousePointer2 className="h-3 w-3" aria-hidden /> Drag to rotate
      </span>
    </div>
  );
}
