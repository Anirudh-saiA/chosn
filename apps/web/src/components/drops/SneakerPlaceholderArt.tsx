import { SneakerArt } from '@/components/ui/SneakerArt';
import { paletteFor } from '@/lib/sneaker/palette';

/**
 * The catalog has no product photography yet, so the fallback is the
 * designed SneakerArt illustration tinted from the colourway, sitting on a
 * colourway-coloured spotlight. A real `imageUrl` (from
 * resolveSneakerImage / primaryImageUrl) always wins when present.
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
      // Plain <img>, not next/image — no known remote domain to allow-list yet.
      <img src={imageUrl} alt={`${brand} ${model} ${colorway}`} className={`h-full w-full object-cover ${className}`} />
    );
  }

  const p = paletteFor(colorway, brand);
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden border border-text/[0.08] bg-vault-deep/70 ${aspect === 'square' ? 'aspect-square' : 'aspect-[16/9]'} ${className}`}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: `radial-gradient(60% 70% at 50% 65%, ${p.glow}50, transparent 75%)` }}
      />
      <SneakerArt
        colorway={colorway}
        brand={brand}
        palette={p}
        className="relative h-[82%] w-[82%]"
      />
    </div>
  );
}
