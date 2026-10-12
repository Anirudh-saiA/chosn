'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Fills its (relatively positioned) parent: the selected photo large, a thumbnail
 * strip underneath and prev/next arrows once there is more than one angle. A photo
 * that fails to load (retailer removed it) is dropped instead of leaving a broken tile.
 */
export function SneakerGallery({ images, alt }: { images: string[]; alt: string }) {
  const [broken, setBroken] = useState<ReadonlySet<string>>(new Set());
  const [selected, setSelected] = useState(0);

  const shown = images.filter((src) => !broken.has(src));
  if (shown.length === 0) return null;

  const index = Math.min(selected, shown.length - 1);
  const current = shown[index] as string;
  const many = shown.length > 1;
  const go = (delta: number) => setSelected((index + delta + shown.length) % shown.length);
  const drop = (src: string) => setBroken((prev) => new Set(prev).add(src));

  return (
    <div
      className="absolute inset-0 flex flex-col outline-none"
      tabIndex={many ? 0 : -1}
      onKeyDown={(e) => {
        if (!many) return;
        if (e.key === 'ArrowLeft') go(-1);
        if (e.key === 'ArrowRight') go(1);
      }}
      aria-roledescription={many ? 'carousel' : undefined}
      aria-label={many ? `${alt} photos` : undefined}
    >
      <div className="relative min-h-0 flex-1">
        <img
          key={current}
          src={current}
          alt={`${alt}${many ? ` — photo ${index + 1} of ${shown.length}` : ''}`}
          onError={() => drop(current)}
          className="absolute inset-0 h-full w-full object-contain p-8 sm:p-10"
        />
        {many && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-text/15 bg-vault-raised/80 text-text backdrop-blur transition-colors hover:bg-vault-raised"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next photo"
              className="absolute right-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-text/15 bg-vault-raised/80 text-text backdrop-blur transition-colors hover:bg-vault-raised"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </>
        )}
      </div>

      {many && (
        <div className="relative z-10 flex gap-2 overflow-x-auto px-4 pb-4 pt-1" role="tablist" aria-label="Choose a photo">
          {shown.map((src, i) => (
            <button
              key={src}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Show photo ${i + 1}`}
              onClick={() => setSelected(i)}
              className={`h-16 w-16 shrink-0 overflow-hidden border bg-white transition-colors sm:h-[72px] sm:w-[72px] ${
                i === index ? 'border-brass' : 'border-text/15 hover:border-text/40'
              }`}
            >
              <img src={src} alt="" loading="lazy" onError={() => drop(src)} className="h-full w-full object-contain p-1" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
