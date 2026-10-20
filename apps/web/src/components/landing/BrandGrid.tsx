import Link from 'next/link';
import { brandLogoFile } from '@/components/ui/BrandMark';

/**
 * Every brand in the catalogue, in the same fixed-size tile so they read as one set. A brand with a logo file (/public/brands) shows it;
 * one without shows its name as a wordmark, so no brand is left out. Fed by the same brand list as the Brands page.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const MIN_SHOES = 5; // brands with fewer shoes than this are on the Brands page, not on this tile wall
const FIRST = ['Nike', 'adidas', 'Puma', 'New Balance', 'ASICS', 'Onitsuka Tiger', 'Converse', 'Vans', 'Reebok', 'Fila', 'Hoka', 'On', 'Salomon', 'Saucony', 'Skechers', 'Under Armour'];
// Spellings of one brand are folded together so it gets a single tile.
const ALIAS: Record<string, string> = {
  onitsuka: 'Onitsuka Tiger',
  'saucony originals': 'Saucony',
  'brooks running': 'Brooks',
  'puma motorsport': 'Puma',
  'hoka one one': 'Hoka',
  'off-white l/ab': 'Off-White',
  'u.s. polo assn. women': 'U.S. Polo Assn.',
  'on running': 'On',
  clarks: 'Clarks Originals',
  hermes: 'Hermès',
};
const NOT_BRANDS = new Set(['superkicks']); // a store name that slipped in as a brand

interface Tile {
  name: string;
  count: number;
}

async function brands(): Promise<Tile[]> {
  try {
    const res = await fetch(`${API_URL}/catalog/search?limit=1`, { next: { revalidate: 600 } });
    if (!res.ok) return [];
    const raw = ((await res.json()) as { facets: { brands: Array<{ value: string; count: number }> } }).facets.brands;
    const merged = new Map<string, Tile>();
    for (const b of raw) {
      const key = b.value.trim().toLowerCase();
      if (NOT_BRANDS.has(key)) continue;
      const name = ALIAS[key] ?? b.value.trim();
      const k = name.toLowerCase();
      const have = merged.get(k);
      merged.set(k, { name: have?.name ?? name, count: (have?.count ?? 0) + b.count });
    }
    const list = [...merged.values()].filter((t) => t.count >= MIN_SHOES);
    const rank = (t: Tile) => {
      const i = FIRST.findIndex((f) => f.toLowerCase() === t.name.toLowerCase());
      return i >= 0 ? i : FIRST.length + (brandLogoFile(t.name) ? 0 : 1000);
    };
    return list.sort((a, b) => rank(a) - rank(b) || b.count - a.count);
  } catch {
    return [];
  }
}

export async function BrandGrid({ className = '' }: { className?: string }) {
  const tiles = await brands();
  if (tiles.length === 0) return null;
  return (
    <div className={className}>
      <ul aria-label="Brands we track" className="grid w-fit grid-cols-4 gap-2">
        {tiles.map((t) => {
          const file = brandLogoFile(t.name);
          return (
            <li key={t.name} title={`${t.name} (${t.count.toLocaleString('en-IN')} shoes)`}>
              <Link
                href={`/sneakers?brand=${encodeURIComponent(t.name)}`}
                className="flex h-12 w-20 items-center justify-center rounded-lg border border-[#0A0A0A]/10 bg-white/70 px-1 backdrop-blur transition-colors hover:bg-white"
              >
                {file ? (
                  <img
                    src={`/brands/${file}`}
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
          );
        })}
      </ul>
      <Link href="/brands" className="mt-3 inline-block font-mono text-[0.72rem] font-bold uppercase tracking-[0.14em] text-[#0A0A0A]/70 underline underline-offset-4 hover:text-[#0A0A0A]">
        See every brand
      </Link>
    </div>
  );
}
