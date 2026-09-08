interface SneakerPlaceholderProps {
  className?: string;
  tone?: 'bone' | 'ink';
  variant?: 'mark' | 'profile';
}

/**
 * NOT real photography — still a placeholder, but art-directed as one
 * rather than a technical line drawing: a solid, cropped, graphic mark
 * with real weight and a soft directional shadow, closer to how a
 * fashion site treats a hero object than a wireframe icon would. Real
 * licensed photography is still the actual brief; no image-generation
 * tool or stock-photo access exists in this environment to produce or
 * fabricate it with, and the three reference images shared in this
 * session carry real, visible trademarks (Nike swoosh, Vans styling,
 * "BOOST"/"KITH" text) with no confirmed usage rights — using them
 * on a real deployed product isn't something to do quietly. This mark
 * is the honest middle ground: it commits to a real visual language
 * (silhouette, crop, rim-lit edge in the accent color) so the page
 * reads as considered rather than empty, while never pretending to be
 * a photo. Every component here takes a `className` sized for a
 * full-bleed treatment — swapping in real photography later is a
 * drop-in prop change, not a refactor.
 *
 * `variant="mark"` — a tight, cropped three-quarter angle, for the
 * hero, where the brief calls for "dramatic angles." `variant="profile"`
 * — a full side silhouette, better suited to the statement section's
 * smaller, rotated placement.
 */
export function SneakerPlaceholder({ className, tone = 'ink', variant = 'mark' }: SneakerPlaceholderProps) {
  const fill = tone === 'bone' ? '#F7F5F0' : '#0A0A0A';
  const rim = '#C1652F';
  const gradId = `sneaker-shadow-${tone}-${variant}`;

  if (variant === 'profile') {
    return (
      <svg viewBox="0 0 400 220" className={className} role="img" aria-label="Placeholder mark — real product photography pending">
        <defs>
          <radialGradient id={gradId} cx="50%" cy="60%" r="60%">
            <stop offset="0%" stopColor={fill} stopOpacity="0.16" />
            <stop offset="100%" stopColor={fill} stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="210" cy="190" rx="170" ry="18" fill={`url(#${gradId})`} />
        <path
          d="M28 168 C 26 148, 42 138, 66 132 L 96 124 C 118 112, 138 96, 168 84 C 204 70, 246 66, 284 74 C 308 79, 322 90, 330 104 C 348 104, 366 114, 371 132 C 376 150, 368 168, 348 172 L 40 172 C 32 172, 28 172, 28 168 Z"
          fill={fill}
        />
        <path d="M96 124 L 118 172 M168 84 L 196 172 M284 74 L 298 172" stroke={tone === 'bone' ? '#0A0A0A' : '#F7F5F0'} strokeOpacity="0.14" strokeWidth="2" />
        <path d="M28 168 C 26 148, 42 138, 66 132 L 96 124 C 118 112, 138 96, 168 84 C 204 70, 246 66, 284 74 C 308 79, 322 90, 330 104" fill="none" stroke={rim} strokeWidth="2" strokeLinecap="round" />
        <path d="M28 172 L 371 172" stroke={fill} strokeWidth="10" strokeLinecap="round" />
      </svg>
    );
  }

  // "mark" — a tighter, steeper three-quarter crop, more graphic than
  // literal, meant to fill a full-bleed hero frame the way a dramatic
  // photo crop would rather than sitting centered as an icon.
  return (
    <svg viewBox="0 0 320 340" className={className} role="img" aria-label="Placeholder mark — real product photography pending">
      <defs>
        <radialGradient id={gradId} cx="50%" cy="85%" r="55%">
          <stop offset="0%" stopColor={fill} stopOpacity="0.2" />
          <stop offset="100%" stopColor={fill} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="160" cy="300" rx="130" ry="24" fill={`url(#${gradId})`} />
      <path
        d="M40 90 C 60 70, 95 62, 120 74 C 145 86, 150 110, 175 118 C 210 128, 245 122, 270 140 C 290 154, 296 178, 288 200 C 300 208, 306 226, 298 244 C 290 262, 268 270, 246 268 L 66 268 C 46 268, 34 254, 36 234 C 24 226, 18 208, 26 190 C 20 172, 26 150, 42 138 C 34 122, 32 104, 40 90 Z"
        fill={fill}
      />
      <path
        d="M40 90 C 60 70, 95 62, 120 74 C 145 86, 150 110, 175 118 C 210 128, 245 122, 270 140 C 290 154, 296 178, 288 200"
        fill="none"
        stroke={rim}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M120 74 L 150 268 M175 118 L 210 268" stroke={tone === 'bone' ? '#0A0A0A' : '#F7F5F0'} strokeOpacity="0.14" strokeWidth="2.5" />
      <path d="M36 234 L 298 244" stroke={fill} strokeWidth="16" strokeLinecap="round" />
    </svg>
  );
}
