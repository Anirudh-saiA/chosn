interface SneakerPlaceholderProps {
  className?: string;
  tone?: 'bone' | 'ink';
}

/**
 * NOT real photography — a generic, unbranded silhouette standing in
 * for the "large, high-quality product photography" the brief calls
 * for. There's no image-generation tool or licensed stock-photo access
 * in this environment to source or fabricate real sneaker photos with,
 * and inventing something that *looks* like a real photo would be
 * worse than an honest placeholder. Swap the `<svg>` below for a real
 * `<Image>` (licensed photography, cropped/angled per the brief) —
 * every component in landing/ takes a `className` sized for a
 * full-bleed treatment, so the swap is a drop-in, not a refactor.
 */
export function SneakerPlaceholder({ className, tone = 'ink' }: SneakerPlaceholderProps) {
  const stroke = tone === 'bone' ? '#F7F5F0' : '#0A0A0A';
  return (
    <svg
      viewBox="0 0 400 260"
      className={className}
      role="img"
      aria-label="Placeholder — real product photography pending"
    >
      <path
        d="M40 190 C 40 160, 55 145, 85 140 C 110 136, 120 120, 145 108 C 175 94, 210 90, 250 95 C 285 99, 305 112, 320 130 C 335 130, 352 138, 358 155 C 364 172, 358 190, 340 196 L 55 196 C 45 196, 40 194, 40 190 Z"
        fill="none"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M85 140 L 100 178 M145 108 L 168 178 M250 95 L 262 178"
        stroke={stroke}
        strokeWidth="1.5"
        opacity="0.5"
      />
      <path d="M40 190 L 358 190" stroke={stroke} strokeWidth="2.5" />
    </svg>
  );
}
