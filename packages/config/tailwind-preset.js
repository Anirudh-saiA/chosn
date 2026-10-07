/**
 * Shared Tailwind preset — the direct translation of the CHOSN Design
 * Tokens doc (Day 2) into build config. Every value here traces back to
 * that document; nothing is invented at this layer.
 *
 * https://claude.ai/code/artifact/30c20344-2bf9-46ac-8993-43e5342a4853
 */

/**
 * "Paper & graphite" — the light repaint of the v2 "Obsidian Luxe"
 * system. Every token below KEEPS its original name and role (surface
 * ramp, text, metals, aura accents, reserved signal colors) — only the
 * hex values flip from dark-surface/light-text to light-surface/
 * dark-text. This is deliberate: ~80 files across the app reference
 * these exact class names (bg-vault-deep, text-brass, border-ice,
 * etc.), so changing *what a token means* without renaming it is what
 * makes this a safe app-wide repaint instead of a find-and-replace
 * across every component.
 *
 * Paper tone is a desaturated, slightly cool stone-grey — deliberately
 * NOT a warm cream (#F4F1EA-style creams read as the generic
 * "AI-generated landing page" default). Graphite text is near-black,
 * not pure #000, same reasoning as the old near-white #e6e8ec text
 * was never pure #fff.
 */
const colors = {
  // Surfaces — same floor→elevated ramp, inverted lightness direction.
  // vault-high (elevation/hover) now reads as "closer to white," the
  // same way it used to read as "closer to white-hot" against black;
  // vault-recessed (terminal/ticker readouts) is now the one surface
  // that's visibly *darker* than the page, for the same sunken-inset
  // feel it had on dark.
  'vault-deep': '#FFFFFF', // page floor
  vault: '#FAFAFA', // base surface
  'vault-raised': '#FFFFFF', // raised surface (cards)
  'vault-high': '#FFFFFF', // hovered / elevated surfaces
  'vault-recessed': '#EFEFEF', // one step darker than vault — terminal/ticker readouts
  chalk: '#D8EAF8',
  'chalk-recessed': '#BBD6EC',

  // Neutral ramp — borders, dividers, secondary text on either surface.
  // Unchanged: a mid-tone slate works as a divider against both a dark
  // and a light surface without needing its own light/dark variant.
  moss: '#6C7386',

  // Next-gen luxury metals + the one functional glow. Platinum/chrome is
  // the cool metal; Ice is strictly a *functional energy* accent —
  // focus rings, active states, terrain lines, halo. Never hover, never a CTA.
  // Liquid chrome: logo, trim, secondary UI, hairlines. Deepened from the
  // old near-white #e0e5ff, which would have nearly vanished against
  // paper — same metal, same cool-blue character, just dark enough to
  // read as a line/trim color instead of a highlight.
  platinum: '#4A5578',
  chrome: '#4A5578',
  'chrome-mid': '#7B84A3',
  'chrome-shadow': '#A7ADC4',
  // Aura: violet = rim light / active / focal; ice = focus rings + light tint.
  // Both deepened for 4.5:1+ text contrast against paper — the old
  // values were tuned for contrast against near-black and fail badly
  // on a light surface.
  violet: '#6A42E8',
  'violet-light': '#4A2BB5', // small-text / focus-critical (>= 4.5:1 on paper)
  ultramarine: '#4338ca',
  ice: '#0E7FAE',
  'ice-soft': '#3E8FC4',

  // Reserved accents — see Day 2 principle 04. Never used decoratively.
  // Deepened for the same reason as violet/ice above: these are real
  // signal colors used as text/fills, not just glows, and the old
  // values were tuned for a near-black backdrop.
  signal: '#0F9D66', // buy signals, positive trend deltas, verified badges
  brass: '#D97E00', // CHOSN's actual brand color — wordmark, dividers, SKU chips
  'brass-bright': '#ffd24d', // highlight end of the brass gradient — stays vivid, only ever used inside a gradient stop, never standalone
  rust: '#D1294B', // wait signals, negative trend deltas

  // Text — graphite, not pure black; same restraint the old near-white
  // #e6e8ec had instead of pure white. text-chalk/-soft already held
  // the exact dark-on-light values this system needed, so text/
  // text-soft now match them rather than inventing a third pair.
  text: '#14213D',
  'text-soft': '#3B4A6B',
  'text-faint': '#5A6A8A',
  'text-chalk': '#14213D',
  'text-chalk-soft': '#3B4A6B',

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
      // rgb literals updated to match the deepened violet/ice/brass/
      // signal/rust hexes above — a colored ring+blur glow still reads
      // as emphasis on a light surface, it just needs the same deeper
      // hue the solid-fill tokens now use, not the old near-pastel one.
      'glow-violet': '0 0 0 1px rgba(106,66,232,.5), 0 0 32px -4px rgba(106,66,232,.6)',
      'glow-ice': '0 0 0 1px rgba(14,127,174,.45), 0 0 28px -4px rgba(14,127,174,.5)',
      'glow-brass': '0 0 0 1px rgba(217,126,0,.35), 0 8px 40px -8px rgba(217,126,0,.45)',
      'glow-signal': '0 0 0 1px rgba(15,157,102,.35), 0 8px 40px -8px rgba(15,157,102,.4)',
      'glow-rust': '0 0 0 1px rgba(209,41,75,.35), 0 8px 40px -8px rgba(209,41,75,.4)',
      lift: '0 24px 60px -24px rgba(0,0,0,.18), 0 2px 0 0 rgba(255,255,255,.6) inset',
      // Was a white top-highlight (a believable "catching the light"
      // cue against a dark surface) — a white highlight at 5% opacity
      // on a paper background is invisible. Flipped to a faint dark
      // line so a "raised" surface still reads as raised on paper.
      inset: 'inset 0 -1px 0 0 rgba(20,27,22,.06)',
    },
    extend: {
      colors,
      fontFamily: {
        // Populated by next/font's CSS variables in apps/web/src/app/layout.tsx
        // Heading face: Futura Condensed Extra Bold when installed on the device, else Anton (free, same look).
        display: ['"Futura Condensed ExtraBold"', '"Futura Bold Condensed"', '"Futura-CondensedExtraBold"', 'var(--font-impact)', 'Impact', 'sans-serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'], // Archivo
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'], // JetBrains Mono
        // Landing-page-only — see the `ink`/`bone`/`ember` comment above.
        editorial: ['"Futura Condensed ExtraBold"', '"Futura Bold Condensed"', '"Futura-CondensedExtraBold"', 'var(--font-impact)', 'Impact', 'sans-serif'],
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
        'brass-gradient': 'linear-gradient(135deg, #cf7600 0%, #bf6200 50%, #a04c00 100%)',
        // Was a near-white sheen for shimmering against black; inverted
        // to a dark-to-mid slate sheen so the same metallic highlight
        // reads against paper instead of disappearing into it.
        'chrome-gradient': 'linear-gradient(135deg, #2E3650 0%, #4A5578 26%, #8890AC 52%, #4A5578 72%, #2E3650 100%)',
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
