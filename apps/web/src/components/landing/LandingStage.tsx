'use client';

import dynamic from 'next/dynamic';
import type { Pose } from '@/components/three/SneakerStage';

const SneakerCanvas = dynamic(() => import('@/components/three/SneakerCanvas').then((m) => m.SneakerCanvas), {
  ssr: false,
});

/** CHOSN's signature colourway: black upper, brass accents, cream sole. */
const HERO_PALETTE = {
  upper: '#d8e0ed',
  accent: '#f0f4ff',
  toe: '#c3cee4',
  heel: '#7c5cff',
  sole: '#d6ecff',
  lace: '#f2f4f9',
  glow: '#7c5cff',
  metal: true,
  pearl: true,
  iceSole: true,
};

const HIDDEN = { x: 0.85, y: 0.7, scale: 0.001, rotY: 0.4, floor: 0, glow: 0 };

/**
 * Order matches the [data-stage] sections on the landing page. Scroll
 * position interpolates between consecutive poses, so the one shoe
 * travels, spins and explodes as the story advances.
 */
const POSES: Pose[] = [
  { key: 'hero', x: 0.44, y: 0.0, scale: 1.08, rotY: -0.55, rotX: 0.04, explode: 0, floor: 1, glow: 1 },
  { key: 'track', x: -0.5, y: 0.02, scale: 0.95, rotY: 0.75, rotX: 0.08, explode: 0, floor: 1, glow: 1 },
  { key: 'compare', x: 0.46, y: 0.04, scale: 0.8, rotY: -0.35, rotX: 0.16, explode: 1, floor: 0.5, glow: 0.8 },
  { key: 'decide', x: -0.5, y: 0.0, scale: 1.0, rotY: 3.0, rotX: 0.1, explode: 0, floor: 1, glow: 1.1 },
  { key: 'terminal', ...HIDDEN },
  { key: 'trending', ...HIDDEN },
  { key: 'drops', ...HIDDEN },
  { key: 'community', ...HIDDEN },
  { key: 'cta', x: 0, y: 0.36, scale: 1.0, rotY: -0.5, rotX: 0.05, explode: 0, floor: 1, glow: 1.2 },
];

export function LandingStage() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
      <SneakerCanvas palette={HERO_PALETTE} mode="landing" poses={POSES} className="h-full w-full" label="CHOSN sneaker" />
    </div>
  );
}
