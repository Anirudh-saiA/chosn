'use client';

import { WishlistIcon } from '@/components/ui/WishlistIcon';
import { useWishlist, type WishlistItem } from '@/lib/wishlist';

/** Round save / unsave button for a sneaker card. Sits beside (not inside) the card's link. */
export function WishlistButton({ item, className = '' }: { item: Omit<WishlistItem, 'savedAt'>; className?: string }) {
  const { has, toggle } = useWishlist();
  const saved = has(item.styleCode);
  return (
    <button
      type="button"
      onClick={() => toggle(item)}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${item.model} from wishlist` : `Save ${item.model} to wishlist`}
      className={`flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#0A0A0A] transition-all duration-300 hover:scale-105 ${
        saved ? 'bg-[#0A0A0A] text-white' : 'bg-white text-[#0A0A0A]'
      } ${className}`}
    >
      <WishlistIcon className="h-[18px] w-[18px]" />
    </button>
  );
}
