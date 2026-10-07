'use client';

import Link from 'next/link';
import { WishlistIcon } from '@/components/ui/WishlistIcon';
import { useWishlist } from '@/lib/wishlist';

/** Header entry point: the gift icon with a live count of saved sneakers. */
export function WishlistNav() {
  const { items } = useWishlist();
  return (
    <Link
      href="/wishlist"
      aria-label={items.length ? `Wishlist, ${items.length} saved` : 'Wishlist'}
      className="relative flex h-10 w-10 items-center justify-center text-[#0A0A0A] transition-opacity hover:opacity-60"
    >
      <WishlistIcon className="h-[22px] w-[22px]" />
      {items.length > 0 && (
        <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#0A0A0A] px-1 font-mono text-[0.62rem] font-bold leading-none text-white">
          {items.length}
        </span>
      )}
    </Link>
  );
}
