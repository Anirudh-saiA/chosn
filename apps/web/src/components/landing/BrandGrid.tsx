/** Brand logos (files in /public/brands), all drawn in the same fixed-size tile so they read as one set. */
const BRANDS = [
  ['Nike', 'nike'],
  ['adidas', 'adidas'],
  ['Puma', 'puma'],
  ['New Balance', 'new-balance'],
  ['ASICS', 'asics'],
  ['Onitsuka Tiger', 'onitsuka-tiger'],
  ['Converse', 'converse'],
  ['Vans', 'vans'],
  ['Reebok', 'reebok'],
  ['Fila', 'fila'],
  ['Hoka', 'hoka'],
  ['On', 'on-running'],
  ['Salomon', 'salomon'],
  ['Saucony', 'saucony'],
  ['Skechers', 'skechers'],
  ['Under Armour', 'under-armour'],
] as const;

export function BrandGrid({ className = '' }: { className?: string }) {
  return (
    <ul aria-label="Brands we track" className={`grid w-fit grid-cols-4 gap-2 ${className}`}>
      {BRANDS.map(([name, file]) => (
        <li key={file} title={name} className="flex h-12 w-20 items-center justify-center rounded-lg border border-[#0A0A0A]/10 bg-white/70 backdrop-blur">
          <img
            src={`/brands/${file}.png`}
            alt={name}
            loading="lazy"
            decoding="async"
            draggable={false}
            width={56} height={28} className="h-7 w-14 select-none object-contain opacity-80 transition-opacity duration-300 hover:opacity-100"
          />
        </li>
      ))}
    </ul>
  );
}
