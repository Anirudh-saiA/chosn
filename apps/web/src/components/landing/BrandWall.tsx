'use client';

import Link from 'next/link';
import { useState } from 'react';

export interface BrandTile {
  name: string;
  count: number;
  file: string | null;
}

const SHOWN = 15; // tiles visible at first; the next tile is the "+N" button that opens the rest

/** The brand tiles: the first few, then a "+N" tile that opens every other brand. */
export function BrandWall({ tiles }: { tiles: BrandTile[] }) {
  const [all, setAll] = useState(false);
  const hidden = tiles.length - SHOWN;
  const list = all || hidden <= 1 ? tiles : tiles.slice(0, SHOWN);
  const shoes = tiles.reduce((n, t) => n + t.count, 0);
  return (
    <div>
      <p className="mb-2 font-mono text-[0.72rem] font-bold uppercase tracking-[0.14em] text-[#0A0A0A]/70">
        {tiles.length} brands &middot; {shoes.toLocaleString('en-IN')} shoes in stock
      </p>
      <ul aria-label="Brands we track" className="grid w-fit grid-cols-4 gap-2">
        {list.map((t) => (
          <li key={t.name} title={`${t.name} (${t.count.toLocaleString('en-IN')} shoes)`}>
            <Link
              href={`/sneakers?brand=${encodeURIComponent(t.name)}`}
              className="flex h-12 w-20 items-center justify-center rounded-lg border border-[#0A0A0A]/10 bg-white/70 px-1 backdrop-blur transition-colors hover:bg-white"
            >
              {t.file ? (
                <img
                  src={`/brands/${t.file}`}
                  alt={t.name}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  width={56}
                  height={28}
                  className="h-7 w-14 select-none object-contain opacity-80 transition-opacity duration-300 hover:opacity-100"
                />
              ) : (
                <span className="line-clamp-2 text-center font-display text-[0.62rem] uppercase leading-[1.05] tracking-[0.04em] text-[#0A0A0A]/80">{t.name}</span>
              )}
            </Link>
          </li>
        ))}
        {!all && hidden > 1 ? (
          <li>
            <button
              type="button"
              onClick={() => setAll(true)}
              aria-label={`Show ${hidden} more brands`}
              className="flex h-12 w-20 items-center justify-center rounded-lg border border-[#0A0A0A] bg-[#0A0A0A] font-display text-lg text-white transition-transform hover:scale-[1.03]"
            >
              +{hidden}
            </button>
          </li>
        ) : null}
      </ul>
      {all ? (
        <button type="button" onClick={() => setAll(false)} className="mt-3 font-mono text-[0.72rem] font-bold uppercase tracking-[0.14em] text-[#0A0A0A]/70 underline underline-offset-4 hover:text-[#0A0A0A]">
          Show fewer
        </button>
      ) : null}
    </div>
  );
}
