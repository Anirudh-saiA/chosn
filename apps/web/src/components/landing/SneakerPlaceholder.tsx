interface SneakerPlaceholderProps {
  className?: string;
  tone?: 'bone' | 'ink';
}

/**
 * NOT real photography — a placeholder standing in for the "large,
 * high-quality product photography" the brief calls for. No image-
 * generation tool or licensed stock-photo access exists in this
 * environment to source or fabricate real photos with, and the
 * several reference images shared in this session all carried real,
 * unconfirmed-rights trademarks (Nike, Vans, Red Bull, a likely-still-
 * copyrighted vintage press photo) — using any of them on a real
 * deployed product wasn't something to do quietly. Swap the `<svg>`
 * below for a real `<Image>` whenever licensed photography exists;
 * every caller sizes this via `className`, so the swap is a drop-in.
 *
 * A single, simple side-profile silhouette (sole bar + upper), not
 * the tighter three-quarter "mark" crop this component shipped with
 * first — that version, seen live, read as an unrecognizable blob
 * rather than a shoe. A plain, standard low-top profile is a known-
 * legible shape even as flat line art; anything more stylized than
 * that needs an actual illustrator's eye or a real reference photo to
 * get right, not another guess without a way to see the result.
 */
export function SneakerPlaceholder({ className, tone = 'ink' }: SneakerPlaceholderProps) {
  const fill = tone === 'bone' ? '#F7F5F0' : '#0A0A0A';
  const sole = tone === 'bone' ? '#D9D4C8' : '#2A2A2A';
  const rim = '#C1652F';
  const gradId = `sneaker-shadow-${tone}`;

  return (
    <svg viewBox="0 0 400 200" className={className} role="img" aria-label="Placeholder — real product photography pending">
      <defs>
        <radialGradient id={gradId} cx="50%" cy="70%" r="55%">
          <stop offset="0%" stopColor={fill} stopOpacity="0.18" />
          <stop offset="100%" stopColor={fill} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="205" cy="188" rx="180" ry="14" fill={`url(#${gradId})`} />

      {/* Upper: toe rounding up, rising over the tongue, a small bump
          for the ankle collar, curving down the heel back — the same
          handful of landmarks every simple sneaker-profile icon uses,
          on purpose, for legibility over style. */}
      <path
        d="M35 160 C 32 144, 36 126, 56 113 C 82 92, 112 68, 146 57 C 166 51, 182 53, 197 62
           C 222 76, 252 82, 282 86 C 312 90, 337 84, 357 93 C 374 101, 382 114, 382 130 L 382 160 Z"
        fill={fill}
      />
      <path
        d="M35 160 C 32 144, 36 126, 56 113 C 82 92, 112 68, 146 57 C 166 51, 182 53, 197 62
           C 222 76, 252 82, 282 86 C 312 90, 337 84, 357 93 C 374 101, 382 114, 382 130"
        fill="none"
        stroke={rim}
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Sole: a plain stadium bar under the upper — the single
          strongest "this is a shoe" cue a flat silhouette has. */}
      <rect x="20" y="155" width="365" height="26" rx="13" fill={sole} />
    </svg>
  );
}
