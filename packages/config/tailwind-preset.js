/**
 * Shared Tailwind preset — the direct translation of the CHOSN Design
 * Tokens doc (Day 2) into build config. Every value here traces back to
 * that document; nothing is invented at this layer.
 *
 * https://claude.ai/code/artifact/30c20344-2bf9-46ac-8993-43e5342a4853
 */

const colors = {
  // Surfaces
  vault: '#0F1613',
  'vault-raised': '#182420',
  'vault-recessed': '#0A0F0C', // one step darker than vault — terminal/ticker readouts
  chalk: '#EFF1EA',
  'chalk-recessed': '#E4E6DC',

  // Neutral ramp — borders, dividers, secondary text on either surface
  moss: '#6B7268',

  // Reserved accents — see Day 2 principle 04. Never used decoratively.
  signal: '#22CC85', // buy signals, positive trend deltas, verified badges
  brass: '#C6963C', // CHOSN's actual brand color — wordmark, dividers, SKU chips
  rust: '#C4643B', // wait signals, negative trend deltas

  // Text
  text: '#EDEFE7',
  'text-soft': '#9CA69C',
  'text-faint': '#6C766B',
  'text-chalk': '#141B16',
  'text-chalk-soft': '#57604F',
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    // Overridden, not extended — Day 2 principle 02: exactly one
    // radius/shadow language, everywhere, no exceptions.
    borderRadius: {
      none: '0px',
      DEFAULT: '0px',
      chip: '2px', // the one allowance: small interactive chips/badges
    },
    boxShadow: {
      none: 'none', // depth comes from surface contrast, never a shadow
    },
    extend: {
      colors,
      fontFamily: {
        // Populated by next/font's CSS variables in apps/web/src/app/layout.tsx
        display: ['var(--font-display)', 'Georgia', 'serif'], // Zilla Slab
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'], // Archivo
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'], // JetBrains Mono
      },
      fontSize: {
        // Day 2 §02 type scale. Weight is applied per-component via
        // font-{weight} utilities — Tailwind's fontSize tuple doesn't
        // carry weight, so it isn't pretended to here.
        'display-hero': ['4rem', { lineHeight: '1.03', letterSpacing: '-0.01em' }],
        'display-section': ['2.25rem', { lineHeight: '1.1', letterSpacing: '-0.005em' }],
        body: ['1rem', { lineHeight: '1.65' }],
        'data-hero': ['2.75rem', { lineHeight: '1', letterSpacing: '-0.01em' }],
        'data-inline': ['0.9375rem', { lineHeight: '1.3' }],
        'data-delta': ['0.875rem', { lineHeight: '1.2' }],
        'ui-label': ['0.8125rem', { lineHeight: '1.2', letterSpacing: '0.02em' }],
        meta: ['0.75rem', { lineHeight: '1.4' }],
      },
      // spacing: intentionally not overridden. Tailwind's default scale
      // (1=4px, 2=8px, 3=12px, 4=16px, 6=24px, 8=32px, 12=48px, 16=64px,
      // 24=96px) already sits exactly on Day 2's 4px grid.
      transitionTimingFunction: {
        chosn: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
