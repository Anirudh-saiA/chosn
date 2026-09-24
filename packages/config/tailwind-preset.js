/**
 * Shared Tailwind preset — the direct translation of the CHOSN Design
 * Tokens doc (Day 2) into build config. Every value here traces back to
 * that document; nothing is invented at this layer.
 *
 * https://claude.ai/code/artifact/30c20344-2bf9-46ac-8993-43e5342a4853
 */

const colors = {
  // Surfaces
  'vault-deep': '#030407', // page floor — one step below vault, where aurora glows sit
  vault: '#070a12',
  'vault-raised': '#0c111d',
  'vault-high': '#131a2a', // hovered / elevated surfaces
  'vault-recessed': '#02030A', // one step darker than vault — terminal/ticker readouts
  chalk: '#EFF1EA',
  'chalk-recessed': '#E4E6DC',

  // Neutral ramp — borders, dividers, secondary text on either surface
  moss: '#6C7386',

  // Next-gen luxury metals + the one functional glow. Platinum/chrome is
  // the cool metal; Ice is strictly a *functional energy* accent —
  // focus rings, active states, terrain lines, halo. Never hover, never a CTA.
  // Liquid chrome: logo, trim, secondary UI, hairlines.
  platinum: '#e0e5ff',
  chrome: '#e0e5ff',
  'chrome-mid': '#a7b0d6',
  'chrome-shadow': '#6a7396',
  // Aura: violet = rim light / active / focal; ice = focus rings + light tint.
  violet: '#7c5cff',
  'violet-light': '#a78bff', // small-text / focus-critical (>= 5.5:1 on obsidian)
  ultramarine: '#4338ca',
  ice: '#8FD6FF',
  'ice-soft': '#5FA9D6',

  // Reserved accents — see Day 2 principle 04. Never used decoratively.
  signal: '#2ef2a6', // buy signals, positive trend deltas, verified badges
  brass: '#ffa800', // CHOSN's actual brand color — wordmark, dividers, SKU chips
  'brass-bright': '#ffd24d', // highlight end of the brass gradient
  rust: '#ff4f6d', // wait signals, negative trend deltas

  // Text
  text: '#e6e8ec',
  'text-soft': '#a9b1c6',
  'text-faint': '#8089a3',
  'text-chalk': '#141B16',
  'text-chalk-soft': '#57604F',

  // Landing-page-only fashion-editorial fork — deliberately separate
  // names from the ramp above (never `black`/`white`, which would
  // read as generic overrides of the real system) so it's obvious at
  // a glance which surface a class belongs to. Scoped to
  // components/landing/ — nothing else in the app should reference
  // these. `ember`: burnt amber, the one pick from the brief's three
  // options — closest in spirit to the site's real brand color
  // (`brass` above), so even this one-off fork isn't a totally
  // unrelated color story.
  ink: '#0A0A0A',
  bone: '#F7F5F0',
  ember: '#C1652F',
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    // Overridden, not extended — Day 2 principle 02: exactly one
    // radius/shadow language, everywhere, no exceptions.
    // Sharp edges stay CHOSN's signature (stamped-tag look). `full` is
    // only for status dots and avatar rings — never a card or button.
    borderRadius: {
      none: '0px',
      DEFAULT: '0px',
      chip: '2px',
      full: '9999px',
    },
    // v2 (UI overhaul): depth is still mostly surface contrast, but
    // luminous glows are allowed — they read as light, not as drop shadows.
    boxShadow: {
      none: 'none',
      'glow-violet': '0 0 0 1px rgba(124,92,255,.5), 0 0 32px -4px rgba(124,92,255,.6)',
      'glow-ice': '0 0 0 1px rgba(143,214,255,.45), 0 0 28px -4px rgba(143,214,255,.5)',
      'glow-brass': '0 0 0 1px rgba(255,168,0,.35), 0 8px 40px -8px rgba(255,168,0,.45)',
      'glow-signal': '0 0 0 1px rgba(46,242,166,.35), 0 8px 40px -8px rgba(46,242,166,.4)',
      'glow-rust': '0 0 0 1px rgba(255,79,109,.35), 0 8px 40px -8px rgba(255,79,109,.4)',
      lift: '0 24px 60px -24px rgba(0,0,0,.75), 0 2px 0 0 rgba(255,255,255,.03) inset',
      inset: 'inset 0 1px 0 0 rgba(255,255,255,.05)',
    },
    extend: {
      colors,
      fontFamily: {
        // Populated by next/font's CSS variables in apps/web/src/app/layout.tsx
        display: ['var(--font-display)', 'Georgia', 'serif'], // Fraunces
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'], // Archivo
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'], // JetBrains Mono
        // Landing-page-only — see the `ink`/`bone`/`ember` comment above.
        editorial: ['var(--font-display)', 'Georgia', 'serif'],
        grotesk: ['var(--font-sans)', 'system-ui', 'sans-serif'],
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
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      backgroundImage: {
        'brass-gradient': 'linear-gradient(135deg, #ffd24d 0%, #fff1c2 16%, #ffa800 50%, #e07a00 100%)',
        'chrome-gradient': 'linear-gradient(135deg, #ffffff 0%, #e0e5ff 26%, #6a7396 52%, #e0e5ff 72%, #a7b0d6 100%)',
        'signal-gradient': 'linear-gradient(135deg, #8ffad4 0%, #2ef2a6 60%, #14b87c 100%)',
      },
      keyframes: {
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        shimmer: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        pulseDot: { '0%': { boxShadow: '0 0 0 0 currentColor' }, '70%,100%': { boxShadow: '0 0 0 8px transparent' } },
      },
      animation: {
        marquee: 'marquee 40s linear infinite',
        shimmer: 'shimmer 2.2s linear infinite',
        float: 'float 6s ease-in-out infinite',
        'pulse-dot': 'pulseDot 1.8s ease-out infinite',
      },
    },
  },
  plugins: [],
};
