/**
 * A brand's logo for a card or tile. Files live in /public/brands. A brand with no file gets its name set as a small bold wordmark,
 * so every card has something in the logo notch and no brand is skipped.
 */
const FILES: Record<string, string> = {
  nike: 'nike.png',
  adidas: 'adidas.png',
  puma: 'puma.png',
  'new balance': 'new-balance.png',
  asics: 'asics.png',
  onitsuka: 'onitsuka-tiger.png',
  'onitsuka tiger': 'onitsuka-tiger.png',
  converse: 'converse.png',
  vans: 'vans.png',
  reebok: 'reebok.png',
  fila: 'fila.png',
  hoka: 'hoka.png',
  'hoka one one': 'hoka.png',
  on: 'on-running.png',
  'on running': 'on-running.png',
  salomon: 'salomon.png',
  saucony: 'saucony.png',
  skechers: 'skechers.png',
  'under armour': 'under-armour.png',
  jordan: 'jordan.svg',
};

/** The logo file for a brand (in /public/brands), or null when there is none. */
export function brandLogoFile(brand: string): string | null {
  return FILES[brand.trim().toLowerCase()] ?? null;
}

export function BrandMark({ brand, className = '' }: { brand: string; className?: string }) {
  const file = FILES[brand.trim().toLowerCase()];
  if (file) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`/brands/${file}`} alt={brand} className={`h-5 w-auto max-w-[4.5rem] select-none object-contain ${className}`} draggable={false} loading="lazy" />
    );
  }
  return <span className={`max-w-[5.5rem] truncate font-display text-[0.8rem] uppercase leading-none tracking-[0.06em] text-[#0A0A0A] ${className}`}>{brand}</span>;
}
