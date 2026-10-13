'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Marketplace-style product photos: one fixed square frame with the selected photo
 * (always `contain`, same padding, so every shoe renders at the same size), and a
 * thumbnail rail beside it on desktop / below it on phones. A photo that fails to
 * load (the retailer removed it) is dropped instead of leaving a broken tile.
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
      className="flex flex-col gap-3 outline-none md:flex-row-reverse md:gap-4"
      tabIndex={many ? 0 : -1}
      onKeyDown={(e) => {
        if (!many) return;
        if (e.key === 'ArrowLeft') go(-1);
        if (e.key === 'ArrowRight') go(1);
      }}
      aria-roledescription={many ? 'carousel' : undefined}
      aria-label={many ? `${alt} photos` : undefined}
    >
      <div className="group relative aspect-square w-full min-w-0 overflow-hidden rounded-2xl border border-text/10 bg-[#F3F3F1] md:flex-1">
        <img
          key={current}
          src={current}
          alt={`${alt}${many ? ` — photo ${index + 1} of ${shown.length}` : ''}`}
          onError={() => drop(current)}
          className="absolute inset-0 h-full w-full object-contain p-6 mix-blend-darken sm:p-8"
        />
        {many && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-text/10 bg-white/90 text-text opacity-100 transition-opacity hover:bg-white md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next photo"
              className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-text/10 bg-white/90 text-text opacity-100 transition-opacity hover:bg-white md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-text/80 px-2.5 py-1 font-mono text-[0.65rem] tracking-[0.08em] text-white">
              {index + 1} / {shown.length}
            </span>
          </>
        )}
      </div>

      {many && (
        <div
          className="flex shrink-0 gap-2 overflow-x-auto md:max-h-[560px] md:w-[72px] md:flex-col md:overflow-y-auto md:overflow-x-hidden"
          role="tablist"
          aria-label="Choose a photo"
        >
          {shown.map((src, i) => (
            <button
              key={src}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Show photo ${i + 1}`}
              onClick={() => setSelected(i)}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-[#F3F3F1] transition-colors md:h-[72px] md:w-[72px] ${
                i === index ? 'border-text' : 'border-transparent ring-1 ring-text/10 hover:ring-text/30'
              }`}
            >
              <img src={src} alt="" loading="lazy" onError={() => drop(src)} className="h-full w-full object-contain p-1 mix-blend-darken" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
