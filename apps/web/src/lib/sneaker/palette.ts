/**
 * Derives a believable sneaker palette from a colorway string. The
 * catalog has no photography, so every product gets designed art whose
 * colors actually match its name ("Panda" is black + white, "Chicago"
 * is white/red/black...). Unknown colorways get a stable hue hashed
 * from the string, so a given shoe always looks the same.
 */
export interface SneakerPalette {
  upper: string;
  accent: string;
  sole: string;
  toe: string;
  heel: string;
  lace: string;
  glow: string;
  /** liquid-metal trim (accent + heel render as polished chrome) */
  metal?: boolean;
  /** frosted titanium-pearl upper (cool metallic sheen) */
  pearl?: boolean;
  /** translucent glacier-ice sole with a glowing core */
  iceSole?: boolean;
}

const COLORS: Record<string, string> = {
  black: '#15181a',
  white: '#f2f0ea',
  sail: '#e9e2cf',
  cream: '#eadfc4',
  ivory: '#efe8d6',
  grey: '#8b9096',
  gray: '#8b9096',
  smoke: '#a9adb1',
  silver: '#bfc4c8',
  red: '#c8262b',
  bred: '#c8262b',
  chicago: '#c8262b',
  crimson: '#a91d2f',
  burgundy: '#6d1f2b',
  maroon: '#5e1a26',
  orange: '#e8742a',
  peach: '#f0a17d',
  yellow: '#f0c42d',
  gold: '#d6a740',
  green: '#2f8f5b',
  olive: '#6b7a3e',
  sage: '#98a98b',
  mint: '#9fdcc0',
  teal: '#1d8c8a',
  blue: '#2f63c9',
  royal: '#1f4fc0',
  navy: '#1c2a52',
  university: '#6aa8e6',
  carolina: '#7fb6e9',
  aqua: '#5fd0d6',
  purple: '#6b3fb0',
  lilac: '#b79be0',
  pink: '#e58fb7',
  rose: '#d9738f',
  brown: '#6b4630',
  mocha: '#5b3d2e',
  tan: '#b58a5a',
  khaki: '#b0a071',
  wheat: '#c9a66b',
  gum: '#b78a55',
  bone: '#ddd5c2',
};

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

function hsl(h: number, s: number, l: number): string {
  return `hsl(${h} ${s}% ${l}%)`;
}

function luminance(hex: string): number {
  if (!hex.startsWith('#')) return 0.5;
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function paletteFor(colorway: string, brand = ''): SneakerPalette {
  const text = `${colorway}`.toLowerCase();
  const found: string[] = [];
  for (const word of text.split(/[^a-z]+/)) {
    const c = COLORS[word];
    if (c && !found.includes(c)) found.push(c);
  }
  // named colourways that don't spell their colours
  if (/panda/.test(text)) found.splice(0, found.length, COLORS.white!, COLORS.black!);
  if (/samba|og/.test(text) && found.length === 0) found.push(COLORS.white!, COLORS.black!, COLORS.gum!);
  if (/triple/.test(text) && found.length) found.push(found[0]!);

  if (found.length === 0) {
    const h = hashHue(colorway + brand);
    found.push(hsl(h, 32, 88), hsl(h, 70, 42), hsl((h + 30) % 360, 60, 24));
  }

  const [a, b, c] = found;
  const upper = a!;
  const accent = b ?? (luminance(upper) > 0.4 ? '#15181a' : '#f2f0ea');
  const heel = c ?? accent;
  const light = luminance(upper) > 0.35;
  return {
    upper,
    accent,
    toe: b ?? (light ? '#e2dfd5' : '#22272a'),
    heel,
    sole: /gum|samba|campus/.test(text) ? COLORS.gum! : light ? '#eeeae0' : '#d9d5c9',
    lace: light ? '#f7f5ee' : '#e9e6dc',
    glow: light ? accent : upper,
  };
}
