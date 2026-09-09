interface SkateboardProps {
  className?: string;
  tone?: 'bone' | 'ink';
}

/**
 * Companion mark to SneakerPlaceholder — same honest-placeholder rule
 * applies (see that component's own comment): a plain, deliberately
 * simple side-view deck-and-wheels silhouette, not an attempt at a
 * branded or photo-real board. A skateboard's silhouette reads
 * correctly from very few landmarks (a long low deck, two wheels
 * hanging below it), so this stays simple on purpose rather than
 * risking the same illegibility the first sneaker mark shipped with.
 */
export function Skateboard({ className, tone = 'ink' }: SkateboardProps) {
  const fill = tone === 'bone' ? '#F7F5F0' : '#0A0A0A';
  const wheel = '#C1652F';

  return (
    <svg viewBox="0 0 400 110" className={className} role="img" aria-hidden>
      {/* Deck, with a slight kicktail curve at each end rather than a
          flat-ended bar — the one detail that keeps it from reading as
          a generic rounded rectangle. */}
      <path
        d="M30 46 C 30 34, 40 28, 52 26 L 348 26 C 360 28, 370 34, 370 46
           C 370 54, 362 58, 348 58 L 52 58 C 38 58, 30 54, 30 46 Z"
        fill={fill}
      />
      {/* Trucks */}
      <rect x="90" y="56" width="10" height="12" fill={fill} opacity="0.7" />
      <rect x="300" y="56" width="10" height="12" fill={fill} opacity="0.7" />
      {/* Wheels */}
      <circle cx="95" cy="78" r="16" fill={wheel} />
      <circle cx="305" cy="78" r="16" fill={wheel} />
    </svg>
  );
}
