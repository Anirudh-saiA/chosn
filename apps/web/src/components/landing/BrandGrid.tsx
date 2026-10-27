import Link from 'next/link';
import { brandLogoFile } from '@/components/ui/BrandMark';
import { BrandWall } from './BrandWall';

/**
 * Every brand in the catalogue, in the same fixed-size tile so they read as one set. A brand with a logo file (/public/brands) shows it;
 * one without shows its name as a wordmark, so no brand is left out. Fed by the same brand list as the Brands page.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const MIN_SHOES = 1;
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
      <BrandWall tiles={tiles.map((t) => ({ ...t, file: brandLogoFile(t.name) }))} />
      <Link href="/brands" className="mt-1 inline-flex min-h-11 items-center font-mono text-[0.72rem] font-bold uppercase tracking-[0.14em] text-[#0A0A0A]/70 underline underline-offset-4 hover:text-[#0A0A0A]">
        Browse brands A to Z
      </Link>
    </div>
  );
}
