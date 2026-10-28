import type { Config } from 'tailwindcss';
import preset from '@chosn/config/tailwind-preset';

/**
 * Brand rules in force (founder card fe-brand-rules, 2026-10-27): pure black and white, Inter, no gradients, rupees.
 * The shared preset still carries the old navy / violet / ice tokens under their old names, so they are re-pointed
 * here (same names, neutral values) and every existing class picks the new look up. Kept accents (founder said keep):
 * amber #9A5A00, green #0A6B44, brown #7A4B00.
 */
const config: Config = {
  presets: [preset],
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    // One radius scale (mirrors the --radius-* tokens in globals.css). The shared preset only defined none/DEFAULT/chip/full,
    // which silently dropped every rounded-xl / rounded-2xl class used in components.
    borderRadius: {
      none: '0px',
      sm: '10px',
      DEFAULT: '12px',
      md: '16px',
      lg: '20px',
      xl: '24px',
      '2xl': '24px',
      '3xl': '28px',
      chip: '999px',
      pill: '999px',
      full: '9999px',
    },
    extend: {
      colors: {
        'vault-deep': '#FFFFFF',
        vault: '#FAFAFA',
        'vault-raised': '#FFFFFF',
        'vault-high': '#FFFFFF',
        'vault-recessed': '#F0F0F0',
        chalk: '#EDEDED',
        'chalk-recessed': '#D4D4D4',
        moss: '#6B6B6B',
        platinum: '#404040',
        chrome: '#404040',
        'chrome-mid': '#737373',
        'chrome-shadow': '#A3A3A3',
        violet: '#0A0A0A',
        'violet-light': '#0A0A0A',
        ultramarine: '#0A0A0A',
        ice: '#0A0A0A',
        'ice-soft': '#595959',
        signal: '#0A6B44',
        brass: '#9A5A00',
        'brass-bright': '#9A5A00',
        rust: '#B3261E',
        text: '#0A0A0A',
        'text-soft': '#404040',
        'text-faint': '#595959',
        'text-chalk': '#0A0A0A',
        'text-chalk-soft': '#404040',
        ink: '#0A0A0A',
        bone: '#F5F5F5',
        ember: '#7A4B00',
      },
      fontFamily: {
        display: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        editorial: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        grotesk: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        // Numbers and small caps labels use Inter too (tabular figures are switched on in globals.css).
        mono: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-violet': '0 0 0 1px rgba(10,10,10,.35)',
        'glow-ice': '0 0 0 1px rgba(10,10,10,.35)',
        'glow-brass': '0 0 0 1px rgba(154,90,0,.35)',
        'glow-signal': '0 0 0 1px rgba(10,107,68,.35)',
        'glow-rust': '0 0 0 1px rgba(179,38,30,.35)',
        lift: '0 12px 32px -16px rgba(0,0,0,.25)',
      },
    },
  },
};

export default config;
