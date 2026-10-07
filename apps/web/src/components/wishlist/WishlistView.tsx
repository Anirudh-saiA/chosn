'use client';

import Link from 'next/link';
import { WishlistIcon } from '@/components/ui/WishlistIcon';
import { formatInr } from '@/lib/catalog';
import { useWishlist } from '@/lib/wishlist';

export function WishlistView() {
  const { items, remove } = useWishlist();

  return (
    <div>
      <p className="eyebrow">Saved on this device</p>
      <h1 className="mt-3 font-display text-[clamp(3rem,7vw,5.5rem)] leading-[0.92] text-[#0A0A0A]">Wishlist.</h1>

      {items.length === 0 ? (
        <div className="glass-frost mt-10 flex flex-col items-center gap-5 rounded-3xl px-6 py-16 text-center">
          <WishlistIcon className="h-14 w-14 text-[#0A0A0A]" strokeWidth={1.4} />
          <p className="max-w-sm text-body font-semibold text-text-soft">Nothing saved yet. Tap the gift icon on any sneaker to keep it here.</p>
          <Link
            href="/sneakers"
            className="btn-shine rounded-full bg-[#0A0A0A] px-8 py-3.5 font-sans text-[0.72rem] font-extrabold uppercase tracking-[0.2em] text-white"
          >
            Browse sneakers
          </Link>
        </div>
      ) : (
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((i) => (
            <li key={i.styleCode} className="glass-frost relative flex flex-col overflow-hidden rounded-3xl">
              <Link href={`/sneakers/${encodeURIComponent(i.styleCode)}/${i.size}`} className="flex flex-1 flex-col">
                <div className="relative flex aspect-[4/3] items-center justify-center bg-white/60 p-4">
                  {i.imageUrl ? (
                    <img src={i.imageUrl} alt={`${i.brand} ${i.model} ${i.colorway}`} className="h-full w-full object-contain" />
                  ) : (
                    <WishlistIcon className="h-12 w-12 text-[#0A0A0A]/30" strokeWidth={1.4} />
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1 p-4">
                  <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-brass">{i.brand}</p>
                  <h2 className="font-display text-xl leading-tight text-[#0A0A0A]">{i.model}</h2>
                  <p className="truncate text-meta text-text-soft">{i.colorway}</p>
                  <p className="mt-auto pt-3 font-mono text-[1.2rem] font-bold text-[#0A0A0A]">
                    {i.price !== null ? formatInr(i.price) : 'Compare retailers'}
                  </p>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => remove(i.styleCode)}
                aria-label={`Remove ${i.model} from wishlist`}
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#0A0A0A] bg-[#0A0A0A] text-white transition-transform hover:scale-105"
              >
                <WishlistIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
