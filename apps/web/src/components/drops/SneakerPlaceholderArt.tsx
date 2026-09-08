/**
 * The catalog has no real product photography yet (same gap
 * `SneakerCard.tsx` already documents for the search grid) — this page
 * is meant to be imagery-forward regardless, so rather than reusing the
 * search grid's plain styleCode-in-a-box treatment, this leans into it:
 * the brand/model set in the display face, large, centered, doing the
 * job a photo would in an editorial layout. Not a disguised placeholder
 * — an intentional typographic one, replaced outright the day a real
 * image pipeline exists (`primaryImageUrl` already flows through
 * untouched wherever one is set — see the `imageUrl` prop below).
 */
export function SneakerPlaceholderArt({
  brand,
  model,
  colorway,
  imageUrl,
  aspect = 'square',
  className = '',
}: {
  brand: string;
  model: string;
  colorway: string;
  imageUrl?: string | null;
  aspect?: 'square' | 'wide';
  className?: string;
}) {
  if (imageUrl) {
    return (
      // Plain <img>, not next/image — no known remote domain to
      // allow-list yet, same as SneakerCard.tsx.
      <img
        src={imageUrl}
        alt={`${brand} ${model} ${colorway}`}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center gap-1 border border-moss/15 bg-vault-recessed px-6 text-center ${aspect === 'square' ? 'aspect-square' : 'aspect-[16/9]'} ${className}`}
    >
      <p className="font-mono text-meta uppercase tracking-[0.1em] text-text-faint">{brand}</p>
      <p className="font-display text-display-section leading-tight text-text-soft">{model}</p>
    </div>
  );
}
