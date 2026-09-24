import { HEEL_TAB, LACES, SOLE, STRIPE, TOE_CAP, TONGUE, UPPER, VIEW_H, VIEW_W, toSvgPath } from '@/lib/sneaker/geometry';
import { paletteFor, type SneakerPalette } from '@/lib/sneaker/palette';

/**
 * Flat, designed sneaker illustration tinted from the colorway. Used
 * wherever a product photo is missing (i.e. everywhere, today) — so it
 * has to look intentional: soft ground glow, contact shadow, gradient
 * shading on the upper, stitched detail lines. Purely decorative when
 * accompanied by visible text (aria-hidden); pass `title` to expose it.
 */
export function SneakerArt({
  colorway,
  brand,
  palette,
  title,
  className = '',
  shadow = true,
}: {
  colorway: string;
  brand?: string;
  palette?: SneakerPalette;
  title?: string;
  className?: string;
  shadow?: boolean;
}) {
  const p = palette ?? paletteFor(colorway, brand);
  const id = `sa-${(brand ?? '').length}-${colorway.length}-${p.upper.length}${p.accent.length}`.replace(/[^a-z0-9-]/gi, '');
  return (
    <svg
      viewBox={`-2 -2 ${VIEW_W + 4} ${VIEW_H + 4}`}
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id={`${id}-up`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".28" />
          <stop offset=".55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".32" />
        </linearGradient>
        <linearGradient id={`${id}-sole`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".5" />
          <stop offset="1" stopColor="#000" stopOpacity=".22" />
        </linearGradient>
        <radialGradient id={`${id}-shadow`}>
          <stop offset="0" stopColor="#000" stopOpacity=".55" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}-clip`}>
          <path d={toSvgPath(UPPER)} />
        </clipPath>
      </defs>

      {shadow && <ellipse cx="66" cy="60" rx="62" ry="4.2" fill={`url(#${id}-shadow)`} />}

      {/* sole */}
      <path d={toSvgPath(SOLE)} fill={p.sole} />
      <path d={toSvgPath(SOLE)} fill={`url(#${id}-sole)`} />
      <path d="M8 51.6 L122 51.6" stroke="#000" strokeOpacity=".18" strokeWidth=".7" />
      <path d="M16 55.4 L114 55.4" stroke="#000" strokeOpacity=".12" strokeWidth=".6" strokeDasharray="1.4 1.6" />

      {/* upper */}
      <path d={toSvgPath(UPPER)} fill={p.upper} />
      <g clipPath={`url(#${id}-clip)`}>
        <path d={toSvgPath(TOE_CAP)} fill={p.toe} />
        <path d={toSvgPath(HEEL_TAB)} fill={p.heel} />
        <path d={toSvgPath(STRIPE)} fill={p.accent} />
        <path d={toSvgPath(UPPER)} fill={`url(#${id}-up)`} />
      </g>
      <path d={toSvgPath(TONGUE)} fill={p.upper} />
      <path d={toSvgPath(TONGUE)} fill={`url(#${id}-up)`} />
      {LACES.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={p.lace} strokeWidth="2.1" strokeLinecap="round" />
      ))}
      <path d={toSvgPath(UPPER)} fill="none" stroke="#000" strokeOpacity=".28" strokeWidth=".6" />
      <path
        d="M19 41 C44 42 70 36 91 26"
        fill="none"
        stroke="#fff"
        strokeOpacity=".22"
        strokeWidth=".6"
        strokeDasharray="1.2 1.4"
      />
    </svg>
  );
}
